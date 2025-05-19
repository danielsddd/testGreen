import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { Platform } from 'react-native';

// Constants
export const PLANT_SEARCH_QUERIES = [
  'monstera plant',
  'snake plant',
  'fiddle leaf fig',
  'pothos',
  'succulents',
  'herb garden',
  'cacti',
  'bonsai tree',
  'air plant',
  'peace lily'
];

export class AudioRecorder {
  constructor() {
    this.recording = null;
    this.audioContext = null;
    this.audioStream = null;
    this.audioProcessor = null;
    this.audioData = [];
    this.audioRecorder = null;
    this.isRecording = false;
  }

  cleanup = () => {
    // Clean up recording
    if (this.recording) {
      try {
        this.recording.stopAndUnloadAsync().catch(e => console.log('Error unloading recording:', e));
        this.recording = null;
      } catch (e) {
        console.warn('Error stopping recording:', e);
      }
    }
    
    // Clean up web audio
    if (Platform.OS === 'web') {
      this.isRecording = false;
      
      if (this.audioRecorder) {
        try {
          this.audioRecorder.stop();
          this.audioRecorder = null;
        } catch (e) {
          console.warn('Error stopping audio recorder:', e);
        }
      }
      
      if (this.audioProcessor) {
        try {
          this.audioProcessor.disconnect();
          this.audioProcessor = null;
        } catch (e) {
          console.warn('Error disconnecting audio processor:', e);
        }
      }
      
      if (this.audioContext) {
        try {
          if (this.audioContext.state !== 'closed') {
            this.audioContext.close();
          }
          this.audioContext = null;
        } catch (e) {
          console.warn('Error closing audio context:', e);
        }
      }
      
      if (this.audioStream) {
        try {
          const tracks = this.audioStream.getTracks();
          tracks.forEach(track => track.stop());
          this.audioStream = null;
        } catch (e) {
          console.warn('Error stopping audio stream:', e);
        }
      }
      
      this.audioData = [];
    }
  };

  // Get a random search query for fallback on web
  getRandomSearchQuery = () => {
    const index = Math.floor(Math.random() * PLANT_SEARCH_QUERIES.length);
    return PLANT_SEARCH_QUERIES[index];
  };

  startWebRecording = async () => {
    try {
      this.isRecording = true;
      
      // Get user media with optimized settings for speech
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 44100
        }
      });
      
      // Check for MediaRecorder support
      if ('MediaRecorder' in window) {
        const supportedMimeTypes = [
          'audio/webm',
          'audio/webm;codecs=opus',
          'audio/ogg;codecs=opus',
          'audio/mp4'
        ];
        
        // Find first supported MIME type
        let mimeType = null;
        for (const type of supportedMimeTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            mimeType = type;
            break;
          }
        }
        
        if (mimeType) {
          console.log(`Using MediaRecorder with mime type: ${mimeType}`);
          
          try {
            this.audioRecorder = new MediaRecorder(this.audioStream, {
              mimeType,
              audioBitsPerSecond: 128000
            });
            
            const chunks = [];
            
            this.audioRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) {
                chunks.push(e.data);
              }
            };
            
            this.audioRecorder.onstop = () => {
              if (chunks.length > 0) {
                this.audioData = new Blob(chunks, { type: mimeType });
                console.log(`Recording completed: ${chunks.length} chunks, type: ${mimeType}`);
              }
            };
            
            // Request data every second to ensure we get data even for short recordings
            this.audioRecorder.start(1000);
            console.log('MediaRecorder started successfully');
            return true;
          } catch (recorderError) {
            console.warn('MediaRecorder init failed:', recorderError);
            // Will fall back to AudioContext approach
          }
        }
      }
      
      // Fallback to AudioContext approach
      console.log('Using AudioContext fallback for recording');
      
      // Clear previous data
      this.audioData = [];
      
      // Create audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext({ sampleRate: 44100 });
      
      // Create source from the stream
      const source = this.audioContext.createMediaStreamSource(this.audioStream);
      
      // Create script processor for handling audio data
      this.audioProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      // Process audio data
      this.audioProcessor.onaudioprocess = (e) => {
        if (this.isRecording) {
          const channelData = e.inputBuffer.getChannelData(0);
          this.audioData.push(new Float32Array(channelData));
        }
      };
      
      // Connect nodes
      source.connect(this.audioProcessor);
      this.audioProcessor.connect(this.audioContext.destination);
      
      return true;
    } catch (err) {
      console.error('Web Audio API recording error:', err);
      throw err;
    }
  };
  
  startNativeRecording = async () => {
    console.log('Setting audio mode...');
      
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
    } catch (audioModeError) {
      console.warn('Could not set full audio mode, using fallback', audioModeError);
      // Absolute minimum configuration needed
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true
      });
    }

    console.log('Starting recording...');
    
    // Use a more compatible recording preset
    const { recording: newRecording } = await Audio.Recording.createAsync({
      android: {
        extension: '.wav',
        outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_DEFAULT,
        audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_DEFAULT,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
      },
      ios: {
        extension: '.wav',
        audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: {
        mimeType: 'audio/webm',
        bitsPerSecond: 128000,
      }
    });

    this.recording = newRecording;
    return newRecording;
  };
}

export default AudioRecorder;