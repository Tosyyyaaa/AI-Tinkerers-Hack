'use client';

/**
 * Browser-based audio analysis module inspired by soundDevice library
 * Provides real-time audio level, frequency analysis, and noise detection
 */

export interface AudioAnalysisConfig {
  sampleRate: number;
  fftSize: number;
  smoothingTimeConstant: number;
  minDecibels: number;
  maxDecibels: number;
  updateInterval: number; // ms
}

export interface AudioMetrics {
  volume: number;           // Overall volume level (0-1)
  energy: number;          // Audio energy/RMS (0-1)
  spectralCentroid: number; // Brightness of sound (Hz)
  spectralRolloff: number;  // High frequency content (Hz)
  zeroCrossingRate: number; // Roughness/noise indicator (0-1)
  mfcc: number[];          // Mel-frequency cepstral coefficients
  pitch: number;           // Fundamental frequency (Hz)
  noiseLevel: number;      // Background noise estimation (0-1)
  speechProbability: number; // Likelihood of speech content (0-1)
}

export interface AudioAnalyserCallbacks {
  onAudioData?: (metrics: AudioMetrics) => void;
  onError?: (error: string) => void;
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
}

const DEFAULT_CONFIG: AudioAnalysisConfig = {
  sampleRate: 44100,
  fftSize: 2048,
  smoothingTimeConstant: 0.8,
  minDecibels: -90,
  maxDecibels: -10,
  updateInterval: 100, // 10 times per second
};

export class AudioAnalyser {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  
  private config: AudioAnalysisConfig;
  private callbacks: AudioAnalyserCallbacks;
  private isActive = false;
  private animationFrameId: number | null = null;
  
  // Analysis buffers
  private frequencyData: Uint8Array | null = null;
  private timeData: Uint8Array | null = null;
  private floatFrequencyData: Float32Array | null = null;
  
  // Noise floor estimation
  private noiseFloorHistory: number[] = [];
  private noiseFloorSize = 50; // Number of samples for noise floor
  
  // Pitch detection
  private pitchHistory: number[] = [];
  private pitchHistorySize = 10;

  constructor(config: Partial<AudioAnalysisConfig> = {}, callbacks: AudioAnalyserCallbacks = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.callbacks = callbacks;
  }

  async initialise(): Promise<boolean> {
    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });

      this.callbacks.onPermissionGranted?.();

      // Create audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.config.sampleRate,
      });

      // Create audio nodes
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyserNode = this.audioContext.createAnalyser();
      
      // Configure analyser
      this.analyserNode.fftSize = this.config.fftSize;
      this.analyserNode.smoothingTimeConstant = this.config.smoothingTimeConstant;
      this.analyserNode.minDecibels = this.config.minDecibels;
      this.analyserNode.maxDecibels = this.config.maxDecibels;

      // Connect nodes
      this.sourceNode.connect(this.analyserNode);

      // Create analysis buffers
      const bufferLength = this.analyserNode.frequencyBinCount;
      this.frequencyData = new Uint8Array(bufferLength);
      this.timeData = new Uint8Array(bufferLength);
      this.floatFrequencyData = new Float32Array(bufferLength);

      return true;

    } catch (error) {
      console.error('Failed to initialise audio analyser:', error);
      this.callbacks.onError?.('Failed to access microphone');
      this.callbacks.onPermissionDenied?.();
      return false;
    }
  }

  start(): boolean {
    if (!this.audioContext || !this.analyserNode || this.isActive) {
      return false;
    }

    this.isActive = true;
    this.startAnalysis();
    return true;
  }

  stop(): void {
    this.isActive = false;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  destroy(): void {
    this.stop();

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  private startAnalysis(): void {
    if (!this.isActive || !this.analyserNode || !this.frequencyData || !this.timeData || !this.floatFrequencyData) {
      return;
    }

    // Get frequency and time domain data
    this.analyserNode.getByteFrequencyData(this.frequencyData! as any);
    this.analyserNode.getByteTimeDomainData(this.timeData! as any);
    this.analyserNode.getFloatFrequencyData(this.floatFrequencyData! as any);

    // Analyse audio data
    const metrics = this.analyseAudioData();
    this.callbacks.onAudioData?.(metrics);

    // Schedule next analysis
    this.animationFrameId = requestAnimationFrame(() => this.startAnalysis());
  }

  private analyseAudioData(): AudioMetrics {
    if (!this.frequencyData || !this.timeData || !this.floatFrequencyData) {
      return this.getEmptyMetrics();
    }

    // Calculate volume (RMS of time domain)
    const volume = this.calculateVolume();
    
    // Calculate energy (RMS of frequency domain)
    const energy = this.calculateEnergy();
    
    // Calculate spectral features
    const spectralCentroid = this.calculateSpectralCentroid();
    const spectralRolloff = this.calculateSpectralRolloff();
    
    // Calculate zero crossing rate
    const zeroCrossingRate = this.calculateZeroCrossingRate();
    
    // Estimate pitch
    const pitch = this.estimatePitch();
    
    // Calculate noise level
    const noiseLevel = this.calculateNoiseLevel(volume);
    
    // Estimate speech probability
    const speechProbability = this.estimateSpeechProbability();
    
    // Calculate basic MFCC (simplified version)
    const mfcc = this.calculateBasicMFCC();

    return {
      volume,
      energy,
      spectralCentroid,
      spectralRolloff,
      zeroCrossingRate,
      mfcc,
      pitch,
      noiseLevel,
      speechProbability,
    };
  }

  private calculateVolume(): number {
    if (!this.timeData) return 0;
    
    let sum = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const sample = (this.timeData[i] - 128) / 128; // Convert to -1 to 1
      sum += sample * sample;
    }
    
    const rms = Math.sqrt(sum / this.timeData.length);
    return Math.min(1, rms * 5); // Scale and clamp
  }

  private calculateEnergy(): number {
    if (!this.frequencyData) return 0;
    
    let sum = 0;
    for (let i = 0; i < this.frequencyData.length; i++) {
      const magnitude = this.frequencyData[i] / 255;
      sum += magnitude * magnitude;
    }
    
    return Math.sqrt(sum / this.frequencyData.length);
  }

  private calculateSpectralCentroid(): number {
    if (!this.frequencyData || !this.audioContext) return 0;
    
    let numerator = 0;
    let denominator = 0;
    const nyquist = this.audioContext.sampleRate / 2;
    
    for (let i = 0; i < this.frequencyData.length; i++) {
      const frequency = (i * nyquist) / this.frequencyData.length;
      const magnitude = this.frequencyData[i] / 255;
      
      numerator += frequency * magnitude;
      denominator += magnitude;
    }
    
    return denominator > 0 ? numerator / denominator : 0;
  }

  private calculateSpectralRolloff(): number {
    if (!this.frequencyData || !this.audioContext) return 0;
    
    const totalEnergy = this.frequencyData.reduce((sum, val) => sum + (val / 255), 0);
    const threshold = totalEnergy * 0.85; // 85% rolloff
    
    let cumulativeEnergy = 0;
    const nyquist = this.audioContext.sampleRate / 2;
    
    for (let i = 0; i < this.frequencyData.length; i++) {
      cumulativeEnergy += this.frequencyData[i] / 255;
      if (cumulativeEnergy >= threshold) {
        return (i * nyquist) / this.frequencyData.length;
      }
    }
    
    return nyquist;
  }

  private calculateZeroCrossingRate(): number {
    if (!this.timeData) return 0;
    
    let crossings = 0;
    for (let i = 1; i < this.timeData.length; i++) {
      if ((this.timeData[i] >= 128) !== (this.timeData[i - 1] >= 128)) {
        crossings++;
      }
    }
    
    return crossings / (this.timeData.length - 1);
  }

  private estimatePitch(): number {
    if (!this.timeData) return 0;
    
    // Simple autocorrelation-based pitch detection
    const samples = new Float32Array(this.timeData.length);
    for (let i = 0; i < this.timeData.length; i++) {
      samples[i] = (this.timeData[i] - 128) / 128;
    }
    
    const pitch = this.autocorrelationPitch(samples);
    
    // Update pitch history for smoothing
    this.pitchHistory.push(pitch);
    if (this.pitchHistory.length > this.pitchHistorySize) {
      this.pitchHistory.shift();
    }
    
    // Return median pitch for stability
    const sortedHistory = [...this.pitchHistory].sort((a, b) => a - b);
    return sortedHistory[Math.floor(sortedHistory.length / 2)] || 0;
  }

  private autocorrelationPitch(samples: Float32Array): number {
    if (!this.audioContext) return 0;
    
    const sampleRate = this.audioContext.sampleRate;
    const minPeriod = Math.floor(sampleRate / 800); // 800 Hz max
    const maxPeriod = Math.floor(sampleRate / 80);  // 80 Hz min
    
    let bestCorrelation = 0;
    let bestPeriod = 0;
    
    for (let period = minPeriod; period <= maxPeriod && period < samples.length / 2; period++) {
      let correlation = 0;
      for (let i = 0; i < samples.length - period; i++) {
        correlation += samples[i] * samples[i + period];
      }
      
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }
    
    return bestPeriod > 0 ? sampleRate / bestPeriod : 0;
  }

  private calculateNoiseLevel(currentVolume: number): number {
    // Update noise floor estimation
    this.noiseFloorHistory.push(currentVolume);
    if (this.noiseFloorHistory.length > this.noiseFloorSize) {
      this.noiseFloorHistory.shift();
    }
    
    // Calculate noise floor as 10th percentile (quietest 10% of samples)
    const sortedHistory = [...this.noiseFloorHistory].sort((a, b) => a - b);
    const noiseFloor = sortedHistory[Math.floor(sortedHistory.length * 0.1)] || 0;
    
    // Return noise level: higher values = noisier environment
    // If current volume is much higher than noise floor = low background noise
    // If current volume is close to noise floor = high background noise
    const volumeAboveFloor = Math.max(0, currentVolume - noiseFloor);
    const maxVolumeRange = Math.max(0.1, currentVolume); // Avoid division by zero
    
    // Invert the ratio: high background noise = high noise level
    return Math.min(1, Math.max(0, 1 - (volumeAboveFloor / maxVolumeRange)));
  }

  private estimateSpeechProbability(): number {
    // Simple heuristic based on spectral features
    const spectralCentroid = this.calculateSpectralCentroid();
    const zeroCrossingRate = this.calculateZeroCrossingRate();
    
    // Speech typically has centroid in 1000-3000 Hz range
    const centroidScore = spectralCentroid > 1000 && spectralCentroid < 3000 ? 1 : 0;
    
    // Speech has moderate zero crossing rate
    const zcrScore = zeroCrossingRate > 0.1 && zeroCrossingRate < 0.3 ? 1 : 0;
    
    return (centroidScore + zcrScore) / 2;
  }

  private calculateBasicMFCC(): number[] {
    // Simplified MFCC calculation (first 5 coefficients)
    if (!this.frequencyData) return [0, 0, 0, 0, 0];
    
    const mfcc: number[] = [];
    const numCoeffs = 5;
    
    for (let i = 0; i < numCoeffs; i++) {
      let sum = 0;
      for (let j = 0; j < this.frequencyData.length; j++) {
        const magnitude = this.frequencyData[j] / 255;
        sum += magnitude * Math.cos((Math.PI * i * (j + 0.5)) / this.frequencyData.length);
      }
      mfcc.push(sum);
    }
    
    return mfcc;
  }

  private getEmptyMetrics(): AudioMetrics {
    return {
      volume: 0,
      energy: 0,
      spectralCentroid: 0,
      spectralRolloff: 0,
      zeroCrossingRate: 0,
      mfcc: [0, 0, 0, 0, 0],
      pitch: 0,
      noiseLevel: 0,
      speechProbability: 0,
    };
  }

  // Utility methods for external use
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  isInitialised(): boolean {
    return this.audioContext !== null && this.analyserNode !== null;
  }

  isRunning(): boolean {
    return this.isActive;
  }

  // Get current frequency data for visualisation
  getFrequencyData(): Uint8Array | null {
    if (!this.analyserNode || !this.frequencyData) return null;
    
    this.analyserNode.getByteFrequencyData(this.frequencyData! as any);
    return new Uint8Array(this.frequencyData);
  }

  // Get current time domain data for waveform visualisation
  getTimeData(): Uint8Array | null {
    if (!this.analyserNode || !this.timeData) return null;
    
    this.analyserNode.getByteTimeDomainData(this.timeData! as any);
    return new Uint8Array(this.timeData);
  }
}

// Singleton instance for easy use
let audioAnalyserInstance: AudioAnalyser | null = null;

export function getAudioAnalyser(
  config?: Partial<AudioAnalysisConfig>, 
  callbacks?: AudioAnalyserCallbacks
): AudioAnalyser {
  if (!audioAnalyserInstance) {
    audioAnalyserInstance = new AudioAnalyser(config, callbacks);
  }
  return audioAnalyserInstance;
}

export function resetAudioAnalyser(): void {
  if (audioAnalyserInstance) {
    audioAnalyserInstance.destroy();
    audioAnalyserInstance = null;
  }
}
