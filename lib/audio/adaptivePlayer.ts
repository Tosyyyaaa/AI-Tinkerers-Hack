'use client';

import { VibeDecision } from '@/lib/types/vibe';
import { getSpotifyClient, SpotifyClientCallbacks } from '@/lib/spotify/spotifyClient';
import { getLocalPlayer, LocalPlayerCallbacks } from '@/lib/audio/localPlayer';

export interface AdaptivePlayerCallbacks {
  onPlayerChange?: (playerType: 'spotify' | 'local' | 'none') => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onTrackChange?: (track: any) => void;
  onVolumeChange?: (volume: number) => void;
  onError?: (error: string) => void;
}

export interface AdaptivePlayerState {
  activePlayer: 'spotify' | 'local' | 'none';
  isSpotifyAvailable: boolean;
  isSpotifyReady: boolean;
  isLocalReady: boolean;
  currentVolume: number;
  isPlaying: boolean;
  currentTrack: any;
}

/**
 * Adaptive Player - Intelligently chooses between Spotify and Local audio
 * 
 * Priority order:
 * 1. Spotify Web Playback SDK (if available and authenticated)
 * 2. Local Audio Player (fallback)
 */
class AdaptivePlayer {
  private spotifyClient = getSpotifyClient();
  private localPlayer = getLocalPlayer();
  private callbacks: AdaptivePlayerCallbacks = {};
  
  private state: AdaptivePlayerState = {
    activePlayer: 'none',
    isSpotifyAvailable: false,
    isSpotifyReady: false,
    isLocalReady: true, // Local player is always ready
    currentVolume: 0.5,
    isPlaying: false,
    currentTrack: null,
  };

  constructor(callbacks: AdaptivePlayerCallbacks = {}) {
    this.callbacks = callbacks;
    this.setupSpotifyCallbacks();
    this.setupLocalPlayerCallbacks();
    this.determineActivePlayer();
  }

  private setupSpotifyCallbacks() {
    const spotifyCallbacks: SpotifyClientCallbacks = {
      onReady: (deviceId: string) => {
        console.log('Spotify player ready:', deviceId);
        this.state.isSpotifyReady = true;
        this.state.isSpotifyAvailable = true;
        this.determineActivePlayer();
      },
      onNotReady: (deviceId: string) => {
        console.log('Spotify player not ready:', deviceId);
        this.state.isSpotifyReady = false;
        this.determineActivePlayer();
      },
      onPlayerStateChanged: (state) => {
        if (this.state.activePlayer === 'spotify' && state) {
          this.state.isPlaying = !state.paused;
          this.state.currentTrack = state.track_window.current_track;
          this.callbacks.onPlayStateChange?.(this.state.isPlaying);
          this.callbacks.onTrackChange?.(this.state.currentTrack);
        }
      },
      onError: (error) => {
        console.error('Spotify error:', error);
        this.callbacks.onError?.(`Spotify: ${error.message || error}`);
        // Fall back to local player on Spotify errors
        this.fallbackToLocal();
      },
    };

    // Update the existing Spotify client with our callbacks
    this.spotifyClient = getSpotifyClient(spotifyCallbacks);
  }

  private setupLocalPlayerCallbacks() {
    const localCallbacks: LocalPlayerCallbacks = {
      onTrackChange: (track) => {
        if (this.state.activePlayer === 'local') {
          this.state.currentTrack = track;
          this.callbacks.onTrackChange?.(track);
        }
      },
      onPlayStateChange: (isPlaying) => {
        if (this.state.activePlayer === 'local') {
          this.state.isPlaying = isPlaying;
          this.callbacks.onPlayStateChange?.(isPlaying);
        }
      },
      onVolumeChange: (volume) => {
        if (this.state.activePlayer === 'local') {
          this.state.currentVolume = volume;
          this.callbacks.onVolumeChange?.(volume);
        }
      },
      onError: (error) => {
        console.error('Local player error:', error);
        this.callbacks.onError?.(`Local Player: ${error}`);
      },
    };

    // Update the existing local player with our callbacks
    this.localPlayer = getLocalPlayer(localCallbacks);
  }

  private determineActivePlayer() {
    const previousPlayer = this.state.activePlayer;
    
    // Priority: Spotify (if ready) > Local > None
    if (this.state.isSpotifyReady) {
      this.state.activePlayer = 'spotify';
    } else if (this.state.isLocalReady) {
      this.state.activePlayer = 'local';
    } else {
      this.state.activePlayer = 'none';
    }

    // Notify if player changed
    if (previousPlayer !== this.state.activePlayer) {
      console.log(`Player switched from ${previousPlayer} to ${this.state.activePlayer}`);
      this.callbacks.onPlayerChange?.(this.state.activePlayer);
    }
  }

  private fallbackToLocal() {
    if (this.state.activePlayer === 'spotify') {
      console.log('Falling back to local player due to Spotify issues');
      this.state.activePlayer = 'local';
      this.callbacks.onPlayerChange?.('local');
    }
  }

  async initializeSpotify(accessToken: string): Promise<boolean> {
    try {
      const success = await this.spotifyClient.initialise(accessToken);
      this.state.isSpotifyAvailable = success;
      this.state.isSpotifyReady = success;
      
      if (success) {
        this.determineActivePlayer();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to initialize Spotify:', error);
      this.callbacks.onError?.('Failed to initialize Spotify');
      return false;
    }
  }

  async loadLocalPlaylist(tracks: any[]): Promise<boolean> {
    try {
      return await this.localPlayer.loadPlaylist(tracks);
    } catch (error) {
      console.error('Failed to load local playlist:', error);
      this.callbacks.onError?.('Failed to load local playlist');
      return false;
    }
  }

  async play(): Promise<boolean> {
    switch (this.state.activePlayer) {
      case 'spotify':
        try {
          const success = await this.spotifyClient.togglePlayback();
          if (!success) {
            this.fallbackToLocal();
            return await this.localPlayer.play();
          }
          return success;
        } catch (error) {
          console.error('Spotify play failed:', error);
          this.fallbackToLocal();
          return await this.localPlayer.play();
        }

      case 'local':
        return await this.localPlayer.play();

      default:
        this.callbacks.onError?.('No audio player available');
        return false;
    }
  }

  async pause(): Promise<boolean> {
    switch (this.state.activePlayer) {
      case 'spotify':
        try {
          const success = await this.spotifyClient.togglePlayback();
          if (!success) {
            this.fallbackToLocal();
            return this.localPlayer.pause();
          }
          return success;
        } catch (error) {
          console.error('Spotify pause failed:', error);
          this.fallbackToLocal();
          return this.localPlayer.pause();
        }

      case 'local':
        return this.localPlayer.pause();

      default:
        return false;
    }
  }

  async setVolume(volume: number): Promise<boolean> {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    
    switch (this.state.activePlayer) {
      case 'spotify':
        try {
          const success = await this.spotifyClient.setVolume(clampedVolume);
          if (success) {
            this.state.currentVolume = clampedVolume;
            this.callbacks.onVolumeChange?.(clampedVolume);
          } else {
            // Try local player as fallback
            this.fallbackToLocal();
            return this.localPlayer.setVolume(clampedVolume);
          }
          return success;
        } catch (error) {
          console.error('Spotify volume change failed:', error);
          this.fallbackToLocal();
          return this.localPlayer.setVolume(clampedVolume);
        }

      case 'local':
        const success = this.localPlayer.setVolume(clampedVolume);
        if (success) {
          this.state.currentVolume = clampedVolume;
          this.callbacks.onVolumeChange?.(clampedVolume);
        }
        return success;

      default:
        return false;
    }
  }

  async skipToNext(): Promise<boolean> {
    switch (this.state.activePlayer) {
      case 'spotify':
        try {
          const success = await this.spotifyClient.skipToNext();
          if (!success) {
            this.fallbackToLocal();
            return await this.localPlayer.skipToNext();
          }
          return success;
        } catch (error) {
          console.error('Spotify skip failed:', error);
          this.fallbackToLocal();
          return await this.localPlayer.skipToNext();
        }

      case 'local':
        return await this.localPlayer.skipToNext();

      default:
        return false;
    }
  }

  async skipToPrevious(): Promise<boolean> {
    switch (this.state.activePlayer) {
      case 'spotify':
        try {
          const success = await this.spotifyClient.skipToPrevious();
          if (!success) {
            this.fallbackToLocal();
            return await this.localPlayer.skipToPrevious();
          }
          return success;
        } catch (error) {
          console.error('Spotify skip previous failed:', error);
          this.fallbackToLocal();
          return await this.localPlayer.skipToPrevious();
        }

      case 'local':
        return await this.localPlayer.skipToPrevious();

      default:
        return false;
    }
  }

  /**
   * Adapt playback based on vibe decision
   * This is the main integration point for vibe-based music control
   */
  async adaptPlayback(decision: VibeDecision): Promise<boolean> {
    console.log(`Adapting playback for ${decision.vibeLabel} vibe:`, {
      bpm: decision.suggestedBPM,
      volume: decision.suggestedVolume,
      action: decision.action,
      player: this.state.activePlayer,
    });

    try {
      // Apply volume changes first
      await this.setVolume(decision.suggestedVolume);

      // Handle track actions
      switch (decision.action) {
        case 'skip':
          await this.skipToNext();
          break;
        case 'drop':
          // For 'drop', skip and potentially remove from playlist
          // This would require more advanced playlist management
          await this.skipToNext();
          break;
        case 'keep':
        default:
          // No action needed for 'keep'
          break;
      }

      // Delegate to the appropriate player for any additional adaptations
      switch (this.state.activePlayer) {
        case 'spotify':
          return await this.spotifyClient.adaptPlayback(decision);
        case 'local':
          return await this.localPlayer.adaptPlayback(decision);
        default:
          return false;
      }
    } catch (error) {
      console.error('Failed to adapt playback:', error);
      this.callbacks.onError?.('Failed to adapt playback');
      return false;
    }
  }

  /**
   * Play TTS audio (always uses local player for immediate playback)
   */
  async playTTS(audioBuffer: ArrayBuffer): Promise<boolean> {
    try {
      return await this.localPlayer.playTTS(audioBuffer);
    } catch (error) {
      console.error('Failed to play TTS:', error);
      this.callbacks.onError?.('Failed to play TTS audio');
      return false;
    }
  }

  getCurrentState(): AdaptivePlayerState {
    // Update state from active player
    switch (this.state.activePlayer) {
      case 'spotify':
        const spotifyState = this.spotifyClient.getCurrentState();
        this.state.isPlaying = spotifyState.isPlaying;
        this.state.currentTrack = spotifyState.currentTrack;
        this.state.currentVolume = spotifyState.volume;
        break;
      case 'local':
        const localState = this.localPlayer.getCurrentState();
        this.state.isPlaying = localState.isPlaying;
        this.state.currentTrack = localState.currentTrack;
        this.state.currentVolume = localState.volume;
        break;
    }

    return { ...this.state };
  }

  getActivePlayerType(): 'spotify' | 'local' | 'none' {
    return this.state.activePlayer;
  }

  isSpotifyActive(): boolean {
    return this.state.activePlayer === 'spotify' && this.state.isSpotifyReady;
  }

  isLocalActive(): boolean {
    return this.state.activePlayer === 'local';
  }

  async disconnect(): Promise<void> {
    try {
      this.spotifyClient.disconnect();
      this.localPlayer.destroy();
      
      this.state = {
        activePlayer: 'none',
        isSpotifyAvailable: false,
        isSpotifyReady: false,
        isLocalReady: false,
        currentVolume: 0.5,
        isPlaying: false,
        currentTrack: null,
      };
    } catch (error) {
      console.error('Error disconnecting players:', error);
    }
  }
}

// Singleton instance
let adaptivePlayerInstance: AdaptivePlayer | null = null;

export function getAdaptivePlayer(callbacks?: AdaptivePlayerCallbacks): AdaptivePlayer {
  if (!adaptivePlayerInstance) {
    adaptivePlayerInstance = new AdaptivePlayer(callbacks);
  }
  return adaptivePlayerInstance;
}

export function resetAdaptivePlayer(): void {
  if (adaptivePlayerInstance) {
    adaptivePlayerInstance.disconnect();
    adaptivePlayerInstance = null;
  }
}

export default AdaptivePlayer;
