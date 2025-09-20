'use client';

import { VibeDecision } from '@/lib/types/vibe';

// Spotify Web Playback SDK types (duplicated here to avoid import issues)
interface SpotifyPlayer {
  addListener(event: string, callback: Function): void;
  removeListener(event: string, callback?: Function): void;
  connect(): Promise<boolean>;
  disconnect(): void;
  getCurrentState(): Promise<SpotifyPlayerState | null>;
  setVolume(volume: number): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  togglePlay(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  previousTrack(): Promise<void>;
  nextTrack(): Promise<void>;
  activateElement(): Promise<void>;
}

interface SpotifyPlayerState {
  context: {
    uri: string;
    metadata: any;
  };
  disallows: {
    pausing: boolean;
    peeking_next: boolean;
    peeking_prev: boolean;
    resuming: boolean;
    seeking: boolean;
    skipping_next: boolean;
    skipping_prev: boolean;
  };
  paused: boolean;
  position: number;
  repeat_mode: number;
  shuffle: boolean;
  track_window: {
    current_track: SpotifyTrack;
    next_tracks: SpotifyTrack[];
    previous_tracks: SpotifyTrack[];
  };
}

interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artists: Array<{ name: string; uri: string }>;
  album: {
    name: string;
    uri: string;
    images: Array<{ url: string }>;
  };
  duration_ms: number;
}

export interface SpotifyClientState {
  isAvailable: boolean;
  isReady: boolean;
  deviceId: string | null;
  player: SpotifyPlayer | null;
  currentTrack: SpotifyTrack | null;
  isPlaying: boolean;
  volume: number;
}

export interface SpotifyClientCallbacks {
  onReady?: (deviceId: string) => void;
  onNotReady?: (deviceId: string) => void;
  onPlayerStateChanged?: (state: SpotifyPlayerState | null) => void;
  onError?: (error: any) => void;
}

class SpotifyClient {
  private player: SpotifyPlayer | null = null;
  private deviceId: string | null = null;
  private accessToken: string | null = null;
  private callbacks: SpotifyClientCallbacks = {};
  private state: SpotifyClientState = {
    isAvailable: false,
    isReady: false,
    deviceId: null,
    player: null,
    currentTrack: null,
    isPlaying: false,
    volume: 0.5,
  };

  // Volume change debouncing
  private volumeTimeout: NodeJS.Timeout | null = null;
  private lastVolumeChange = 0;
  private skipTimeout: NodeJS.Timeout | null = null;
  private lastSkipTime = 0;

  constructor(callbacks: SpotifyClientCallbacks = {}) {
    this.callbacks = callbacks;
    this.checkSpotifyAvailability();
  }

  private checkSpotifyAvailability() {
    // Check if Spotify Web Playback SDK is loaded
    if (typeof window !== 'undefined' && window.Spotify) {
      this.state.isAvailable = true;
    } else {
      // Load Spotify Web Playback SDK if not already loaded
      this.loadSpotifySDK();
    }
  }

  private loadSpotifySDK() {
    if (typeof window === 'undefined') return;

    // Check if script is already loaded
    if (document.querySelector('script[src*="sdk.scdn.co"]')) {
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;

    script.onload = () => {
      // Set up the callback for when SDK is ready
      window.onSpotifyWebPlaybackSDKReady = () => {
        this.state.isAvailable = true;
        this.callbacks.onReady?.(this.deviceId || '');
      };
    };

    script.onerror = () => {
      console.warn('Failed to load Spotify Web Playback SDK');
      this.callbacks.onError?.('Failed to load Spotify SDK');
    };

    document.head.appendChild(script);
  }

  async initialise(accessToken: string): Promise<boolean> {
    if (!this.state.isAvailable || !window.Spotify) {
      console.warn('Spotify Web Playback SDK not available');
      return false;
    }

    this.accessToken = accessToken;

    try {
      // Create player instance
      this.player = new window.Spotify.Player({
        name: 'DJBuddy Vibe Check',
        getOAuthToken: (cb) => {
          cb(this.accessToken || '');
        },
        volume: this.state.volume,
      });

      // Set up event listeners
      this.setupPlayerListeners();

      // Connect to the player
      const success = await this.player.connect();
      
      if (success) {
        this.state.player = this.player;
        console.log('Successfully connected to Spotify Web Playback SDK');
        return true;
      } else {
        console.error('Failed to connect to Spotify Web Playback SDK');
        return false;
      }

    } catch (error) {
      console.error('Error initialising Spotify player:', error);
      this.callbacks.onError?.(error);
      return false;
    }
  }

  private setupPlayerListeners() {
    if (!this.player) return;

    // Ready
    this.player.addListener('ready', ({ device_id }: { device_id: string }) => {
      console.log('Ready with Device ID', device_id);
      this.deviceId = device_id;
      this.state.deviceId = device_id;
      this.state.isReady = true;
      this.callbacks.onReady?.(device_id);
    });

    // Not Ready
    this.player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
      console.log('Device ID has gone offline', device_id);
      this.state.isReady = false;
      this.callbacks.onNotReady?.(device_id);
    });

    // Player state changes
    this.player.addListener('player_state_changed', (state: SpotifyPlayerState | null) => {
      if (!state) return;

      this.state.currentTrack = state.track_window.current_track;
      this.state.isPlaying = !state.paused;
      
      this.callbacks.onPlayerStateChanged?.(state);
    });

    // Error handling
    this.player.addListener('initialization_error', ({ message }: { message: string }) => {
      console.error('Failed to initialise:', message);
      this.callbacks.onError?.({ type: 'initialization_error', message });
    });

    this.player.addListener('authentication_error', ({ message }: { message: string }) => {
      console.error('Failed to authenticate:', message);
      this.callbacks.onError?.({ type: 'authentication_error', message });
    });

    this.player.addListener('account_error', ({ message }: { message: string }) => {
      console.error('Failed to validate Spotify account:', message);
      this.callbacks.onError?.({ type: 'account_error', message });
    });

    this.player.addListener('playback_error', ({ message }: { message: string }) => {
      console.error('Failed to perform playback:', message);
      this.callbacks.onError?.({ type: 'playback_error', message });
    });
  }

  async setVolume(volume: number): Promise<boolean> {
    if (!this.player || !this.state.isReady) {
      return false;
    }

    // Clamp volume to valid range
    const clampedVolume = Math.max(0, Math.min(1, volume));
    
    // Debounce volume changes to avoid too frequent API calls
    const now = Date.now();
    if (now - this.lastVolumeChange < 100) { // 100ms debounce
      if (this.volumeTimeout) {
        clearTimeout(this.volumeTimeout);
      }
      
      this.volumeTimeout = setTimeout(() => {
        this.setVolume(clampedVolume);
      }, 100);
      
      return true;
    }

    try {
      await this.player.setVolume(clampedVolume);
      this.state.volume = clampedVolume;
      this.lastVolumeChange = now;
      return true;
    } catch (error) {
      console.error('Failed to set volume:', error);
      return false;
    }
  }

  async skipToNext(): Promise<boolean> {
    if (!this.player || !this.state.isReady) {
      return false;
    }

    // Debounce skip actions to prevent accidental multiple skips
    const now = Date.now();
    if (now - this.lastSkipTime < 10000) { // 10 second debounce
      console.log('Skip action debounced');
      return false;
    }

    try {
      await this.player.nextTrack();
      this.lastSkipTime = now;
      return true;
    } catch (error) {
      console.error('Failed to skip to next track:', error);
      return false;
    }
  }

  async skipToPrevious(): Promise<boolean> {
    if (!this.player || !this.state.isReady) {
      return false;
    }

    try {
      await this.player.previousTrack();
      return true;
    } catch (error) {
      console.error('Failed to skip to previous track:', error);
      return false;
    }
  }

  async togglePlayback(): Promise<boolean> {
    if (!this.player || !this.state.isReady) {
      return false;
    }

    try {
      await this.player.togglePlay();
      return true;
    } catch (error) {
      console.error('Failed to toggle playback:', error);
      return false;
    }
  }

  async adaptPlayback(decision: VibeDecision): Promise<boolean> {
    if (!this.player || !this.state.isReady) {
      return false;
    }

    try {
      // Apply volume changes with gentle ramping
      const currentVolume = this.state.volume;
      const targetVolume = decision.suggestedVolume;
      
      if (Math.abs(currentVolume - targetVolume) > 0.05) {
        // Ramp volume gradually to avoid jarring changes
        await this.rampVolume(currentVolume, targetVolume, 1000); // 1 second ramp
      }

      // Handle track actions
      if (decision.action === 'skip') {
        await this.skipToNext();
      }
      // Note: 'drop' action would require Web API integration for playlist management
      // 'keep' action requires no changes

      return true;
    } catch (error) {
      console.error('Failed to adapt playback:', error);
      return false;
    }
  }

  private async rampVolume(fromVolume: number, toVolume: number, durationMs: number): Promise<void> {
    const steps = 20; // Number of volume steps
    const stepDuration = durationMs / steps;
    const volumeDelta = (toVolume - fromVolume) / steps;

    for (let i = 1; i <= steps; i++) {
      const currentVolume = fromVolume + (volumeDelta * i);
      await this.setVolume(currentVolume);
      
      if (i < steps) {
        await new Promise(resolve => setTimeout(resolve, stepDuration));
      }
    }
  }

  getCurrentState(): SpotifyClientState {
    return { ...this.state };
  }

  async getCurrentTrack(): Promise<SpotifyTrack | null> {
    if (!this.player || !this.state.isReady) {
      return null;
    }

    try {
      const state = await this.player.getCurrentState();
      return state?.track_window?.current_track || null;
    } catch (error) {
      console.error('Failed to get current track:', error);
      return null;
    }
  }

  disconnect(): void {
    if (this.player) {
      this.player.disconnect();
      this.player = null;
    }

    if (this.volumeTimeout) {
      clearTimeout(this.volumeTimeout);
      this.volumeTimeout = null;
    }

    if (this.skipTimeout) {
      clearTimeout(this.skipTimeout);
      this.skipTimeout = null;
    }

    this.state = {
      isAvailable: false,
      isReady: false,
      deviceId: null,
      player: null,
      currentTrack: null,
      isPlaying: false,
      volume: 0.5,
    };
  }
}

// Singleton instance
let spotifyClientInstance: SpotifyClient | null = null;

export function getSpotifyClient(callbacks?: SpotifyClientCallbacks): SpotifyClient {
  if (!spotifyClientInstance) {
    spotifyClientInstance = new SpotifyClient(callbacks);
  }
  return spotifyClientInstance;
}

export function resetSpotifyClient(): void {
  if (spotifyClientInstance) {
    spotifyClientInstance.disconnect();
    spotifyClientInstance = null;
  }
}

export default SpotifyClient;
