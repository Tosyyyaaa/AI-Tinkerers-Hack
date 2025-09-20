'use client';

import { VibeDecision } from '@/lib/types/vibe';

export interface AudioTrack {
  id: string;
  name: string;
  url: string;
  bpm?: number;
  genre?: string;
}

export interface LocalPlayerState {
  isPlaying: boolean;
  currentTrack: AudioTrack | null;
  volume: number;
  currentTime: number;
  duration: number;
  playlist: AudioTrack[];
  currentIndex: number;
}

export interface LocalPlayerCallbacks {
  onTrackChange?: (track: AudioTrack | null) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onVolumeChange?: (volume: number) => void;
  onError?: (error: string) => void;
}

class LocalAudioPlayer {
  private audioElement: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private initPromise: Promise<void> | null = null;
  private isInitialised = false;
  
  private state: LocalPlayerState = {
    isPlaying: false,
    currentTrack: null,
    volume: 0.5,
    currentTime: 0,
    duration: 0,
    playlist: [],
    currentIndex: -1,
  };

  private callbacks: LocalPlayerCallbacks = {};
  private volumeRampTimeout: NodeJS.Timeout | null = null;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(callbacks: LocalPlayerCallbacks = {}) {
    this.callbacks = callbacks;
    this.initPromise = this.initialiseAudio();
  }

  updateCallbacks(callbacks: LocalPlayerCallbacks = {}) {
    this.callbacks = callbacks;
  }

  private async initialiseAudio() {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      // Create audio element
      this.audioElement = new Audio();
      this.audioElement.crossOrigin = 'anonymous';
      this.audioElement.preload = 'metadata';

      // Set up audio context and nodes
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create audio processing nodes
      this.gainNode = this.audioContext.createGain();
      this.compressorNode = this.audioContext.createDynamicsCompressor();
      
      // Configure compressor as a limiter
      this.compressorNode.threshold.setValueAtTime(-10, this.audioContext.currentTime);
      this.compressorNode.knee.setValueAtTime(0, this.audioContext.currentTime);
      this.compressorNode.ratio.setValueAtTime(20, this.audioContext.currentTime);
      this.compressorNode.attack.setValueAtTime(0.003, this.audioContext.currentTime);
      this.compressorNode.release.setValueAtTime(0.01, this.audioContext.currentTime);

      // Create source node from audio element
      this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);

      // Connect the audio graph: source -> gain -> compressor -> destination
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.compressorNode);
      this.compressorNode.connect(this.audioContext.destination);

      // Set initial volume
      this.gainNode.gain.setValueAtTime(this.state.volume, this.audioContext.currentTime);

      // Set up event listeners
      this.setupAudioListeners();

      // Start update interval for current time
      this.updateInterval = setInterval(() => {
        if (this.audioElement) {
          this.state.currentTime = this.audioElement.currentTime;
          this.state.duration = this.audioElement.duration || 0;
        }
      }, 100);

      this.isInitialised = true;
    } catch (error) {
      console.error('Failed to initialise local audio player:', error);
      this.callbacks.onError?.('Failed to initialise audio player');
      this.isInitialised = false;
    }
  }

  private async ensureInitialised(): Promise<boolean> {
    if (this.audioElement) {
      return true;
    }

    if (!this.initPromise) {
      this.initPromise = this.initialiseAudio();
    }

    try {
      await this.initPromise;
    } catch (error) {
      console.error('Local player initialisation error:', error);
      return false;
    }

    return !!this.audioElement;
  }

  private setupAudioListeners() {
    if (!this.audioElement) return;

    this.audioElement.addEventListener('play', () => {
      this.state.isPlaying = true;
      this.callbacks.onPlayStateChange?.(true);
    });

    this.audioElement.addEventListener('pause', () => {
      this.state.isPlaying = false;
      this.callbacks.onPlayStateChange?.(false);
    });

    this.audioElement.addEventListener('ended', async () => {
      this.state.isPlaying = false;
      this.callbacks.onPlayStateChange?.(false);
      // Auto-advance to next track
      await this.skipToNext();
    });

    this.audioElement.addEventListener('loadedmetadata', () => {
      this.state.duration = this.audioElement?.duration || 0;
    });

    this.audioElement.addEventListener('error', (event) => {
      // Ignore spurious errors that fire before a source is assigned
      if (!this.audioElement?.currentSrc) {
        return;
      }

      const error = this.audioElement.error;
      let errorMessage = 'Unknown audio error';

      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Audio playback aborted';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error loading audio';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Audio decode error';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            console.warn('Audio format not supported, skipping track:', this.audioElement.currentSrc);
            // Auto-skip to next track on format error
            this.skipToNext().catch(console.error);
            return;
          default:
            errorMessage = `Audio error (code ${error.code})`;
        }
      }

      console.warn('Audio element warning:', errorMessage, event);
      // Don't call onError for format issues since we handle them gracefully
      if (error?.code !== MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        this.callbacks.onError?.(errorMessage);
      }
    });

    this.audioElement.addEventListener('volumechange', () => {
      if (this.audioElement) {
        this.state.volume = this.audioElement.volume;
        this.callbacks.onVolumeChange?.(this.state.volume);
      }
    });
  }

  async loadPlaylist(tracks: AudioTrack[]): Promise<boolean> {
    const ready = await this.ensureInitialised();
    if (!ready) {
      return false;
    }

    this.state.playlist = [...tracks];
    this.state.currentIndex = -1;
    
    if (tracks.length > 0) {
      return this.loadTrack(0);
    }
    
    return false;
  }

  async loadTrack(index: number): Promise<boolean> {
    const ready = await this.ensureInitialised();
    if (!ready) {
      return false;
    }

    if (!this.audioElement || index < 0 || index >= this.state.playlist.length) {
      return false;
    }

    const track = this.state.playlist[index];
    
    try {
      // Resume audio context if suspended (required by browser policies)
      if (this.audioContext?.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.audioElement.src = track.url;
      this.audioElement.load();
      this.state.currentTrack = track;
      this.state.currentIndex = index;
      
      this.callbacks.onTrackChange?.(track);
      
      return true;
    } catch (error) {
      console.error('Failed to load track:', error);
      this.callbacks.onError?.(`Failed to load track: ${track.name}`);
      return false;
    }
  }

  async play(): Promise<boolean> {
    const ready = await this.ensureInitialised();
    if (!ready || !this.audioElement) {
      return false;
    }

    try {
      // Resume audio context if needed
      if (this.audioContext?.state === 'suspended') {
        await this.audioContext.resume();
      }

      await this.audioElement.play();
      return true;
    } catch (error) {
      console.error('Failed to play audio:', error);
      this.callbacks.onError?.('Failed to play audio');
      return false;
    }
  }

  async pause(): Promise<boolean> {
    const ready = await this.ensureInitialised();
    if (!ready || !this.audioElement) {
      return false;
    }

    try {
      this.audioElement.pause();
      return true;
    } catch (error) {
      console.error('Failed to pause audio:', error);
      return false;
    }
  }

  async togglePlayback(): Promise<boolean> {
    if (this.state.isPlaying) {
      return this.pause();
    } else {
      return await this.play();
    }
  }

  setVolume(volume: number): boolean {
    if (!this.gainNode || !this.audioContext) return false;

    const clampedVolume = Math.max(0, Math.min(1, volume));
    
    try {
      // Use Web Audio API for smooth volume changes
      this.gainNode.gain.setValueAtTime(clampedVolume, this.audioContext.currentTime);
      this.state.volume = clampedVolume;
      return true;
    } catch (error) {
      console.error('Failed to set volume:', error);
      return false;
    }
  }

  async rampVolume(fromVolume: number, toVolume: number, durationMs: number): Promise<void> {
    if (!this.gainNode || !this.audioContext) return;

    const clampedFrom = Math.max(0, Math.min(1, fromVolume));
    const clampedTo = Math.max(0, Math.min(1, toVolume));
    
    try {
      const currentTime = this.audioContext.currentTime;
      const endTime = currentTime + (durationMs / 1000);
      
      // Cancel any existing volume automation
      this.gainNode.gain.cancelScheduledValues(currentTime);
      
      // Set starting volume and ramp to target
      this.gainNode.gain.setValueAtTime(clampedFrom, currentTime);
      this.gainNode.gain.linearRampToValueAtTime(clampedTo, endTime);
      
      this.state.volume = clampedTo;
    } catch (error) {
      console.error('Failed to ramp volume:', error);
    }
  }

  async skipToNext(): Promise<boolean> {
    const ready = await this.ensureInitialised();
    if (!ready) {
      return false;
    }

    if (this.state.currentIndex < this.state.playlist.length - 1) {
      return await this.loadTrack(this.state.currentIndex + 1);
    } else if (this.state.playlist.length > 0) {
      // Loop back to beginning
      return await this.loadTrack(0);
    }
    return false;
  }

  async skipToPrevious(): Promise<boolean> {
    const ready = await this.ensureInitialised();
    if (!ready) {
      return false;
    }

    if (this.state.currentIndex > 0) {
      return await this.loadTrack(this.state.currentIndex - 1);
    } else if (this.state.playlist.length > 0) {
      // Loop to end
      return await this.loadTrack(this.state.playlist.length - 1);
    }
    return false;
  }

  seek(timeSeconds: number): boolean {
    if (!this.audioElement) return false;

    try {
      const clampedTime = Math.max(0, Math.min(this.state.duration, timeSeconds));
      this.audioElement.currentTime = clampedTime;
      this.state.currentTime = clampedTime;
      return true;
    } catch (error) {
      console.error('Failed to seek:', error);
      return false;
    }
  }

  async adaptPlayback(decision: VibeDecision): Promise<boolean> {
    try {
      // Apply volume changes with gentle ramping
      const currentVolume = this.state.volume;
      const targetVolume = decision.suggestedVolume;
      
      if (Math.abs(currentVolume - targetVolume) > 0.05) {
        await this.rampVolume(currentVolume, targetVolume, 1000); // 1 second ramp
      }

      // Handle track actions
      if (decision.action === 'skip') {
        await this.skipToNext();
      } else if (decision.action === 'drop') {
        // For 'drop', we could implement playlist management
        // For now, just skip to next track
        await this.skipToNext();
      }
      // 'keep' action requires no changes

      return true;
    } catch (error) {
      console.error('Failed to adapt playback:', error);
      return false;
    }
  }

  // Play TTS audio from ElevenLabs
  async playTTS(audioBuffer: ArrayBuffer): Promise<boolean> {
    const ready = await this.ensureInitialised();
    if (!ready || !this.audioContext) {
      return false;
    }

    try {
      // Decode audio data
      const audioData = await this.audioContext.decodeAudioData(audioBuffer.slice(0));
      
      // Create buffer source for TTS
      const ttsSource = this.audioContext.createBufferSource();
      const ttsGain = this.audioContext.createGain();
      
      ttsSource.buffer = audioData;
      
      // Connect TTS audio graph (separate from music)
      ttsSource.connect(ttsGain);
      ttsGain.connect(this.audioContext.destination);
      
      // Set TTS volume (slightly lower than music)
      ttsGain.gain.setValueAtTime(0.8, this.audioContext.currentTime);
      
      // Play TTS
      ttsSource.start(0);
      
      return true;
    } catch (error) {
      console.error('Failed to play TTS audio:', error);
      this.callbacks.onError?.('Failed to play TTS audio');
      return false;
    }
  }

  getCurrentState(): LocalPlayerState {
    return { ...this.state };
  }

  destroy(): void {
    // Clear intervals
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.volumeRampTimeout) {
      clearTimeout(this.volumeRampTimeout);
      this.volumeRampTimeout = null;
    }

    // Stop and cleanup audio
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement = null;
    }

    // Cleanup Web Audio API nodes
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.compressorNode) {
      this.compressorNode.disconnect();
      this.compressorNode = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.initPromise = null;
    this.isInitialised = false;

    // Reset state
    this.state = {
      isPlaying: false,
      currentTrack: null,
      volume: 0.5,
      currentTime: 0,
      duration: 0,
      playlist: [],
      currentIndex: -1,
    };
  }
}

// Default playlist with working demo tracks
export const DEFAULT_PLAYLIST: AudioTrack[] = [
  {
    id: 'demo-1',
    name: 'Chill Ambient',
    url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
    bpm: 95,
    genre: 'ambient',
  },
  {
    id: 'demo-2',
    name: 'Upbeat Electronic',
    url: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/Creative_Commons/Kevin_MacLeod/Impact/Kevin_MacLeod_-_Impact_Moderato.mp3',
    bpm: 128,
    genre: 'electronic',
  },
  {
    id: 'demo-3',
    name: 'Focus Music',
    url: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/Creative_Commons/Kevin_MacLeod/Gentle/Kevin_MacLeod_-_Wallpaper.mp3',
    bpm: 110,
    genre: 'lo-fi',
  },
];

// Singleton instance
let localPlayerInstance: LocalAudioPlayer | null = null;

export function getLocalPlayer(callbacks?: LocalPlayerCallbacks): LocalAudioPlayer {
  if (!localPlayerInstance) {
    localPlayerInstance = new LocalAudioPlayer(callbacks);
  } else if (callbacks) {
    localPlayerInstance.updateCallbacks(callbacks);
  }
  return localPlayerInstance;
}

export function resetLocalPlayer(): void {
  if (localPlayerInstance) {
    localPlayerInstance.destroy();
    localPlayerInstance = null;
  }
}

export default LocalAudioPlayer;
