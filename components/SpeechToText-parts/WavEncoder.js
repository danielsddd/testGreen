// WAV encoder implementation for browser
export class WavAudioEncoder {
    constructor(sampleRate, numChannels) {
      this.sampleRate = sampleRate;
      this.numChannels = numChannels;
      this.numSamples = 0;
      this.dataViews = [];
    }
  
    encode(buffer) {
      const len = buffer[0].length;
      const view = new DataView(new ArrayBuffer(len * this.numChannels * 2));
      let offset = 0;
      for (let i = 0; i < len; i++) {
        for (let ch = 0; ch < this.numChannels; ch++) {
          const x = buffer[ch][i] * 0x7FFF;
          view.setInt16(offset, x < 0 ? Math.max(-0x8000, Math.floor(x)) : Math.min(0x7FFF, Math.floor(x)), true);
          offset += 2;
        }
      }
      this.dataViews.push(view);
      this.numSamples += len;
      return this;
    }
  
    finish() {
      const dataSize = this.numChannels * this.numSamples * 2;
      const view = new DataView(new ArrayBuffer(44));
      
      // RIFF identifier
      writeString(view, 0, 'RIFF');
      // File length
      view.setUint32(4, 36 + dataSize, true);
      // RIFF type
      writeString(view, 8, 'WAVE');
      // Format chunk identifier
      writeString(view, 12, 'fmt ');
      // Format chunk length
      view.setUint32(16, 16, true);
      // Sample format (raw)
      view.setUint16(20, 1, true);
      // Channel count
      view.setUint16(22, this.numChannels, true);
      // Sample rate
      view.setUint32(24, this.sampleRate, true);
      // Byte rate (sample rate * block align)
      view.setUint32(28, this.sampleRate * this.numChannels * 2, true);
      // Block align (channel count * bytes per sample)
      view.setUint16(32, this.numChannels * 2, true);
      // Bits per sample
      view.setUint16(34, 16, true);
      // Data chunk identifier
      writeString(view, 36, 'data');
      // Data chunk length
      view.setUint32(40, dataSize, true);
      
      const chunks = [view];
      chunks.push(...this.dataViews);
      
      return new Blob(chunks, { type: 'audio/wav' });
    }
  }
  
  // Helper function to write string to DataView
  export const writeString = (view, offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  export const convertWebmToWav = async (webmBlob) => {
    console.log('Starting WebM to WAV conversion...');
    
    try {
      // Create audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext({ sampleRate: 16000 }); // 16 kHz for better compatibility
      
      // Convert blob to array buffer
      const arrayBuffer = await webmBlob.arrayBuffer();
      
      console.log(`WebM data size: ${arrayBuffer.byteLength} bytes`);
      
      // Decode the WebM audio
      console.log('Decoding WebM audio...');
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      console.log(`Decoded audio: ${audioBuffer.duration}s, ${audioBuffer.numberOfChannels} channels, ${audioBuffer.sampleRate}Hz`);
      
      // Prepare audio data for WAV encoding (resampling to 16 kHz mono if needed)
      const resampledData = [];
      const originalChannel = audioBuffer.getChannelData(0); // Use first channel for mono
      
      // If source is not 16 kHz, resample it
      if (audioBuffer.sampleRate !== 16000) {
        console.log('Resampling audio to 16 kHz...');
        
        // Simple resampling
        const resampleRatio = 16000 / audioBuffer.sampleRate;
        const newLength = Math.floor(originalChannel.length * resampleRatio);
        const resampled = new Float32Array(newLength);
        
        for (let i = 0; i < newLength; i++) {
          const originalIndex = Math.floor(i / resampleRatio);
          resampled[i] = originalChannel[originalIndex];
        }
        
        resampledData.push(resampled);
      } else {
        // No resampling needed
        resampledData.push(originalChannel);
      }
      
      // Create WAV encoder
      console.log('Creating WAV file...');
      const wavEncoder = new WavAudioEncoder(16000, 1); // 16 kHz mono
      
      // Add audio data to encoder
      wavEncoder.encode(resampledData);
      
      // Finish encoding
      const wavBlob = wavEncoder.finish();
      
      console.log(`WAV data created: ${wavBlob.size} bytes`);
      return wavBlob;
    } catch (error) {
      console.error('Failed to convert WebM to WAV:', error);
      throw error;
    }
  };
  
  export const createWavFromAudioBuffer = (audioBuffer) => {
    // Target sample rate of 16kHz for speech recognition
    const targetSampleRate = 16000;
    const numChannels = 1; // Mono
    
    // If we need to resample
    let resampledBuffer;
    if (audioBuffer.sampleRate !== targetSampleRate) {
      const originalData = audioBuffer.getChannelData(0);
      const resampleRatio = targetSampleRate / audioBuffer.sampleRate;
      const newLength = Math.floor(originalData.length * resampleRatio);
      resampledBuffer = new Float32Array(newLength);
      
      for (let i = 0; i < newLength; i++) {
        const originalIndex = Math.floor(i / resampleRatio);
        resampledBuffer[i] = originalData[originalIndex];
      }
    } else {
      resampledBuffer = audioBuffer.getChannelData(0);
    }
    
    // Convert float to int16
    const length = resampledBuffer.length;
    const result = new Int16Array(length);
    for (let i = 0; i < length; i++) {
      const s = Math.max(-1, Math.min(1, resampledBuffer[i]));
      result[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    // Create WAV header
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    
    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // File length
    view.setUint32(4, 36 + result.length * 2, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // Format chunk identifier
    writeString(view, 12, 'fmt ');
    // Format chunk length
    view.setUint32(16, 16, true);
    // Sample format (raw)
    view.setUint16(20, 1, true);
    // Channel count
    view.setUint16(22, numChannels, true);
    // Sample rate
    view.setUint32(24, targetSampleRate, true);
    // Byte rate (sample rate * block align)
    view.setUint32(28, targetSampleRate * numChannels * 2, true);
    // Block align (channel count * bytes per sample)
    view.setUint16(32, numChannels * 2, true);
    // Bits per sample
    view.setUint16(34, 16, true);
    // Data chunk identifier
    writeString(view, 36, 'data');
    // Data chunk length
    view.setUint32(40, result.length * 2, true);
    
    // Combine header and data
    const blob = new Blob([wavHeader, result.buffer], { type: 'audio/wav' });
    return blob;
  };