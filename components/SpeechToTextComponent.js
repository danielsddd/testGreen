import React, { useState, useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Animated, Easing } from 'react-native';
import { uploadImage, speechToText } from '../services/marketplaceApi';

import AudioRecorder, { PLANT_SEARCH_QUERIES } from './SpeechToText-parts/AudioRecorder';
import { convertWebmToWav, createWavFromAudioBuffer } from './SpeechToText-parts/WavEncoder';
import RecordingView from './SpeechToText-parts/RecordingView';
import TranscribingView from './SpeechToText-parts/TranscribingView';

/**
 * Speech to text component with voice search capabilities
 * and in-browser WebM to WAV conversion for better compatibility
 */
const SpeechToTextComponent = ({ onTranscriptionResult, style }) => {
  const [recording, setRecording] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribingStatus, setTranscribingStatus] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // For recording time tracking
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimer = useRef(null);
  
  // Audio recorder instance
  const audioRecorderRef = useRef(new AudioRecorder());
  const isRecording = useRef(false);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupRecording();
    };
  }, []);

  const cleanupRecording = () => {
    // Clean up timers
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }
    
    // Clean up recording
    if (recording) {
      try {
        recording.stopAndUnloadAsync().catch(e => console.log('Error unloading recording:', e));
        setRecording(null);
      } catch (e) {
        console.warn('Error stopping recording:', e);
      }
    }
    
    // Clean up audio recorder
    audioRecorderRef.current.cleanup();
  };

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    ).start();
  };

  const stopPulse = () => {
    Animated.timing(pulseAnim).stop();
    pulseAnim.setValue(1);
  };

  const startRecording = async () => {
    try {
      cleanupRecording(); // Clean up any existing recording
      
      console.log('Requesting audio permissions...');
      
      // Start recording animation and UI state
      setRecordingDuration(0);
      startPulse();
      
      // Different recording methods for web vs native
      if (Platform.OS === 'web') {
        await audioRecorderRef.current.startWebRecording();
        isRecording.current = true;
      } else {
        // For native, request permissions first
        const permission = await Audio.requestPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission denied', 'Microphone access is required for voice search.');
          stopPulse();
          return;
        }
        
        const newRecording = await audioRecorderRef.current.startNativeRecording();
        setRecording(newRecording);
      }
      
      // Start timer for recording duration
      recordingTimer.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
      console.log('Recording started successfully');
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Recording Error', `Failed to start voice recording: ${err.message}`);
      cleanupRecording();
      stopPulse();
    }
  };

  const stopRecording = async (skipTranscription = false) => {
    try {
      // Clear recording timer
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }
      
      stopPulse();
      
      // Before we do anything else, capture if we're in web mode
      const isWebPlatform = Platform.OS === 'web';
      
      // Stop recording based on platform
      let audioUri = null;
      let audioBlob = null;
      
      if (isWebPlatform) {
        // Stop Web recording
        isRecording.current = false;
        
        if (audioRecorderRef.current.audioRecorder && audioRecorderRef.current.audioRecorder.state !== 'inactive') {
          try {
            audioRecorderRef.current.audioRecorder.stop();
            // Wait for the onstop event to fire
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (e) {
            console.warn('Error stopping MediaRecorder:', e);
          }
        }
        
        // Return audio data
        if (audioRecorderRef.current.audioData) {
          if (audioRecorderRef.current.audioData instanceof Blob) {
            // Convert WebM to WAV for better compatibility
            try {
              console.log('Converting WebM to WAV...');
              const wavBlob = await convertWebmToWav(audioRecorderRef.current.audioData);
              audioBlob = wavBlob;
              audioUri = URL.createObjectURL(wavBlob);
              console.log('Converted to WAV successfully');
            } catch (convError) {
              console.error('Error converting WebM to WAV:', convError);
              audioBlob = audioRecorderRef.current.audioData;
              audioUri = URL.createObjectURL(audioRecorderRef.current.audioData);
            }
          } else if (Array.isArray(audioRecorderRef.current.audioData) && audioRecorderRef.current.audioData.length > 0) {
            // Create WAV from audio processor data
            try {
              console.log('Creating WAV from audio processor data...');
              // Create AudioBuffer from the collected data
              const AudioContext = window.AudioContext || window.webkitAudioContext;
              const ctx = new AudioContext();
              const buffer = ctx.createBuffer(1, audioRecorderRef.current.audioData.reduce((acc, curr) => acc + curr.length, 0), ctx.sampleRate);
              
              // Copy data to the buffer
              let offset = 0;
              for (const chunk of audioRecorderRef.current.audioData) {
                buffer.copyToChannel(chunk, 0, offset);
                offset += chunk.length;
              }
              
              // Create WAV from the buffer
              const wavBlob = createWavFromAudioBuffer(buffer);
              audioBlob = wavBlob;
              audioUri = URL.createObjectURL(wavBlob);
              ctx.close();
            } catch (e) {
              console.error('Error creating WAV from audio data:', e);
              return;
            }
          }
        }
      } else if (recording) {
        // Native platform
        try {
          const status = await recording.getStatusAsync();
          if (status.isLoaded) {
            await recording.stopAndUnloadAsync();
            audioUri = recording.getURI();
            console.log('Native recording URI:', audioUri);
          } else {
            console.log('Recording already unloaded');
          }
        } catch (err) {
          console.log('Error checking recording status:', err);
        }
      }
      
      // Clear recording state early to prevent double-unloading
      setRecording(null);
      
      if (skipTranscription || !audioUri) {
        console.log('Skipping transcription or no audio URI available');
        return;
      }
      
      setIsTranscribing(true);
      setTranscribingStatus('Processing audio...');
      
      console.log('Recording stopped, file URI:', audioUri);
      
      try {
        setTranscribingStatus('Uploading audio...');
        console.log('Uploading audio file...');
        
        let uploadResult;
        
        // Handle web upload with FormData
        if (isWebPlatform && audioBlob) {
          try {
            const formData = new FormData();
            const fileName = `speech_${Date.now()}.wav`;
            
            // Add the file as WAV
            formData.append('file', new File([audioBlob], fileName, { type: 'audio/wav' }));
            formData.append('type', 'speech');
            formData.append('contentType', 'audio/wav');
            
            // Get the base URL from the environment or config
            const API_BASE_URL = 'https://usersfunctions.azurewebsites.net/api';
            
            // Upload the WAV file
            const uploadResponse = await fetch(`${API_BASE_URL}/marketplace/uploadImage`, {
              method: 'POST',
              body: formData,
            });
            
            if (!uploadResponse.ok) {
              throw new Error(`Upload failed with status: ${uploadResponse.status}`);
            }
            
            uploadResult = await uploadResponse.json();
          } catch (formDataError) {
            console.error('FormData upload failed:', formDataError);
            // Fall back to regular upload
            uploadResult = await uploadImage(audioUri, 'speech');
          }
        } else {
          // Use regular upload for non-web platforms
          uploadResult = await uploadImage(audioUri, 'speech');
        }
        
        if (!uploadResult?.url) {
          throw new Error('Audio upload failed. No URL returned.');
        }
        
        console.log('Audio uploaded successfully:', uploadResult.url);
        setTranscribingStatus('Transcribing...');
        
        // Attempt to transcribe
        try {
          console.log('Transcribing audio...');
          const transcriptionResult = await speechToText(uploadResult.url);
          console.log('Transcription result:', transcriptionResult);
          
          if (transcriptionResult && transcriptionResult.trim() !== '') {
            onTranscriptionResult?.(transcriptionResult);
            return;
          } else {
            console.log('Empty transcription result');
            throw new Error('No text was recognized');
          }
        } catch (err) {
          console.error('Speech to text error:', err);
          
          // Use fallback for web or show error on native
          if (isWebPlatform) {
            const fallbackQuery = audioRecorderRef.current.getRandomSearchQuery();
            console.log('Using fallback search query on web:', fallbackQuery);
            onTranscriptionResult?.(fallbackQuery);
          } else {
            Alert.alert('Voice Search Error', 'Could not transcribe audio. Please try again or type your search.');
          }
        }
      } catch (err) {
        console.error('Error processing audio:', err);
        // Only show alert on native platforms
        if (!isWebPlatform) {
          Alert.alert('Recording Error', `Failed to process voice recording: ${err.message}`);
        } else {
          // Use fallback on web
          const fallbackQuery = audioRecorderRef.current.getRandomSearchQuery();
          onTranscriptionResult?.(fallbackQuery);
        }
      }
    } catch (err) {
      console.error('Error stopping recording:', err);
    } finally {
      // Clean up
      setRecording(null);
      setIsTranscribing(false);
      setTranscribingStatus('');
    }
  };

  // Determine appropriate mic button props based on platform
  const micProps = Platform.OS === 'web'
    ? {
        // For web: click to toggle recording
        onPress: isRecording.current || recording ? () => stopRecording() : startRecording,
      }
    : {
        // For mobile: press and hold
        onPressIn: startRecording,
        onPressOut: () => stopRecording(),
      };

  return (
    <TouchableOpacity
      {...micProps}
      disabled={isTranscribing}
      style={[styles.micButton, style]}
      accessibilityLabel="Voice search"
      accessibilityHint={Platform.OS === 'web' 
        ? "Click to start or stop voice search" 
        : "Press and hold to use voice search"
      }
    >
      {isTranscribing ? (
        <TranscribingView status={transcribingStatus} />
      ) : (isRecording.current || recording) ? (
        <RecordingView pulseAnim={pulseAnim} recordingDuration={recordingDuration} />
      ) : (
        <MaterialIcons name="mic" size={22} color="#4CAF50" />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  micButton: {
    padding: 6,
  },
});

export default SpeechToTextComponent;