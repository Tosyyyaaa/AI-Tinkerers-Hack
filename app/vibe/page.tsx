'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useVibeSensors } from '@/lib/vibe/useVibeSensors';
import { performVibeCheck } from '@/lib/vibe/interpretVibe';
import { getSpotifyClient } from '@/lib/spotify/spotifyClient';
import { getLocalPlayer, DEFAULT_PLAYLIST } from '@/lib/audio/localPlayer';
import { getAdaptivePlayer } from '@/lib/audio/adaptivePlayer';
import { useWeather } from '@/lib/weather/useWeather';
import { RoomStats, VibeDecision, VibeCheckState } from '@/lib/types/vibe';

// Client-side only wrapper to prevent hydration issues
function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) {
    return null;
  }
  
  return <>{children}</>;
}

// Component for displaying live meters
function VibeMeter({ 
  label, 
  value, 
  max = 1, 
  type 
}: { 
  label: string; 
  value: number; 
  max?: number; 
  type: 'brightness' | 'motion' | 'faces' | 'smiles' 
}) {
  const percentage = Math.min(100, (value / max) * 100);
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {type === 'faces' || type === 'smiles' ? Math.round(value) : value.toFixed(2)}
        </span>
      </div>
      <div className={`vibe-meter vibe-meter-${type}`}>
        <div 
          className="vibe-meter-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Component for displaying vibe decision
function VibeDisplay({ 
  decision, 
  isAI = true 
}: { 
  decision: VibeDecision | null;
  isAI?: boolean;
}) {
  if (!decision) {
    return (
      <div className="stats-card text-center">
        <div className="text-gray-500 dark:text-gray-400">
          No vibe detected yet...
        </div>
        <div className="text-xs text-gray-400 mt-2">
          Start vibe check to begin analysis
        </div>
      </div>
    );
  }

  return (
    <div className="stats-card text-center space-y-4">
      <div className="flex items-center justify-center gap-2 mb-2">
        <div className={`vibe-label vibe-label-${decision.vibeLabel} inline-block animate-pulse`}>
          {decision.vibeLabel.toUpperCase()} VIBE
        </div>
        <div className={`text-xs px-2 py-1 rounded-full ${
          isAI 
            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' 
            : 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300'
        }`}>
          {isAI ? '🤖 AI' : '🧠 Fallback'}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-gray-500 dark:text-gray-400">Suggested BPM</div>
          <div className="text-xl font-bold">{decision.suggestedBPM}</div>
        </div>
        <div>
          <div className="text-gray-500 dark:text-gray-400">Volume</div>
          <div className="text-xl font-bold">{Math.round(decision.suggestedVolume * 100)}%</div>
        </div>
      </div>
      
      {decision.action && decision.action !== 'keep' && (
        <div className="text-sm text-orange-600 dark:text-orange-400">
          Action: {decision.action.toUpperCase()}
        </div>
      )}
      
      <div className="text-sm text-gray-600 dark:text-gray-300 italic">
        "{decision.spokenTip}"
      </div>
    </div>
  );
}

// Privacy tooltip component
function PrivacyTooltip() {
  const [isVisible, setIsVisible] = useState(false);
  
  return (
    <div className="relative inline-block">
      <button
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      </button>
      
      {isVisible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-gray-900 rounded-lg shadow-lg max-w-xs z-10">
          We analyse brightness, motion, and face counts locally; no images leave your device.
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
}

// Weather widget component
function WeatherWidget() {
  const {
    data: weather,
    isLoading,
    error,
    lastUpdated,
    hasLocationPermission,
    refreshWeather,
    fetchWeatherForCity,
    getWeatherIconUrl,
    getWindDirection,
    isStale,
    getWeatherEmoji,
  } = useWeather();

  const [cityInput, setCityInput] = useState('');
  const [showCityInput, setShowCityInput] = useState(false);

  const handleCitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cityInput.trim()) {
      await fetchWeatherForCity(cityInput.trim());
      setCityInput('');
      setShowCityInput(false);
    }
  };

  const formatTime = (timestamp: number) => {
    // Use consistent timezone and format to avoid hydration issues
    return new Date(timestamp * 1000).toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'UTC'
    });
  };

  const getTemperatureColor = (temp: number) => {
    if (temp >= 30) return 'text-red-500';
    if (temp >= 20) return 'text-orange-500';
    if (temp >= 10) return 'text-yellow-500';
    if (temp >= 0) return 'text-blue-500';
    return 'text-blue-700';
  };

  if (error) {
    return (
      <div className="stats-card">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Weather 🌤️
        </h2>
        <div className="text-center py-4">
          <div className="text-red-500 text-sm mb-2">⚠️ {error}</div>
          <button
            onClick={() => refreshWeather()}
            className="text-xs text-blue-500 hover:text-blue-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !weather) {
    return (
      <div className="stats-card">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Weather 🌤️
        </h2>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <div className="text-sm text-gray-500">Loading weather...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="stats-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Weather {getWeatherEmoji(weather.icon)}
        </h2>
        <div className="flex items-center gap-2">
          {isStale && (
            <span className="text-xs text-orange-500" title="Data may be outdated">
              ⚠️
            </span>
          )}
          <button
            onClick={() => setShowCityInput(!showCityInput)}
            className="text-xs text-blue-500 hover:text-blue-600"
            title="Change location"
          >
            📍
          </button>
          <button
            onClick={() => refreshWeather()}
            className="text-xs text-blue-500 hover:text-blue-600"
            title="Refresh weather"
          >
            🔄
          </button>
        </div>
      </div>

      {showCityInput && (
        <form onSubmit={handleCitySubmit} className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              placeholder="Enter city name..."
              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <button
              type="submit"
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Go
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {/* Location and main temp */}
        <div className="text-center">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {weather.location}
          </div>
          <div className="flex items-center justify-center gap-2 mt-1">
            <img
              src={getWeatherIconUrl(weather.icon)}
              alt={weather.description}
              className="w-12 h-12"
            />
            <div className={`text-2xl font-bold ${getTemperatureColor(weather.temperature)}`}>
              {weather.temperature}°C
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
            {weather.description}
          </div>
        </div>

        {/* Weather details */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Feels like:</span>
            <span className="font-medium">{weather.feelsLike}°C</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Humidity:</span>
            <span className="font-medium">{weather.humidity}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Wind:</span>
            <span className="font-medium">
              {weather.windSpeed} km/h {getWindDirection(weather.windDirection)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Clouds:</span>
            <span className="font-medium">{weather.cloudiness}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Pressure:</span>
            <span className="font-medium">{weather.pressure} hPa</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Visibility:</span>
            <span className="font-medium">{weather.visibility} km</span>
          </div>
        </div>

        {/* Sun times */}
        {weather.sunrise > 0 && weather.sunset > 0 && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
            <div className="flex justify-between text-xs">
              <div className="flex items-center gap-1">
                <span>🌅</span>
                <span>{formatTime(weather.sunrise)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span>🌇</span>
                <span>{formatTime(weather.sunset)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Last updated */}
        {lastUpdated && (
          <div className="text-xs text-gray-400 text-center">
            Updated: {new Date(lastUpdated).toLocaleTimeString('en-GB', { 
              hour: '2-digit', 
              minute: '2-digit',
              timeZone: 'UTC'
            })}
          </div>
        )}

        {/* Location permission status */}
        <div className="text-xs text-center">
          <span className={hasLocationPermission ? 'text-green-600' : 'text-gray-500'}>
            📍 {hasLocationPermission ? 'Location enabled' : 'Using fallback location'}
          </span>
        </div>
      </div>
    </div>
  );
}

// Main vibe check page component
function VibeCheckPageInner() {
  // Vibe sensors hook
  const {
    isActive,
    hasPermission,
    hasMicPermission,
    error: sensorError,
    stats,
    videoRef,
    canvasRef,
    startCapture,
    stopCapture,
    getCurrentAudioMetrics,
  } = useVibeSensors();

  // State for vibe checking
  const [vibeState, setVibeState] = useState<VibeCheckState>({
    isActive: false,
    hasPermission: false,
    error: null,
    stats: null,
    decision: null,
  });

  const [isAIDecision, setIsAIDecision] = useState(true);

  const [isProcessing, setIsProcessing] = useState(false);
  const [lastVibeCheck, setLastVibeCheck] = useState<number>(0);
  const [audioPlaying, setAudioPlaying] = useState(false);

  // State for URL context feature
  const [eventUrl, setEventUrl] = useState('');
  const [isExtractingEvent, setIsExtractingEvent] = useState(false);
  const [eventVibeData, setEventVibeData] = useState<any>(null);
  const [urlVibeError, setUrlVibeError] = useState<string | null>(null);

  // Audio players
  const spotifyClient = useRef(getSpotifyClient());
  const localPlayer = useRef(getLocalPlayer({
    onPlayStateChange: (playing) => setAudioPlaying(playing),
    onError: (error) => console.warn('Local player error:', error),
  }));
  const adaptivePlayer = useRef(getAdaptivePlayer({
    onPlayerChange: (playerType) => console.log('Player changed to:', playerType),
    onPlayStateChange: (playing) => setAudioPlaying(playing),
    onError: (error) => console.warn('Adaptive player error:', error),
  }));

  // Refs for intervals
  const vibeCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Update vibe state when sensors change
  useEffect(() => {
    setVibeState(prev => ({
      ...prev,
      isActive,
      hasPermission,
      error: sensorError,
      stats,
    }));
  }, [isActive, hasPermission, sensorError, stats]);

  // Perform vibe check periodically
  const performVibeCheckCycle = useCallback(async () => {
    if (!stats || isProcessing) return;

    const now = Date.now();
    if (now - lastVibeCheck < 1500) return; // Minimum 1.5s between checks

    console.log('🎵 Starting vibe check cycle...', {
      faces: stats.faces,
      smiles: stats.smiles,
      brightness: stats.avgBrightness,
      motion: stats.motionLevel,
      audioVolume: stats.audioVolume,
      audioEnergy: stats.audioEnergy,
    });

    setIsProcessing(true);
    setLastVibeCheck(now);

    try {
      const result = await performVibeCheck(stats, {
        timeout: 8000,
        retries: 1,
        fallbackEnabled: true,
      });

      console.log('🎯 Vibe detected:', {
        vibe: result.decision.vibeLabel,
        bpm: result.decision.suggestedBPM,
        volume: result.decision.suggestedVolume,
        action: result.decision.action,
        tip: result.decision.spokenTip,
      });

      setVibeState(prev => ({
        ...prev,
        decision: result.decision,
        error: result.error || null,
      }));

      // Track if this was an AI decision or fallback
      setIsAIDecision(!result.error);

      // Play TTS audio if available (using adaptive player for better routing)
      if (result.audioBuffer) {
        try {
          console.log('🎤 Playing coaching tip...');
          await adaptivePlayer.current.playTTS(result.audioBuffer);
        } catch (ttsError) {
          console.warn('Failed to play TTS:', ttsError);
          // Fallback to local player
          try {
            await localPlayer.current.playTTS(result.audioBuffer);
          } catch (fallbackError) {
            console.warn('TTS fallback also failed:', fallbackError);
          }
        }
      }

      // Adapt playback based on decision using adaptive player
      try {
        console.log('🎶 Adapting playback...', {
          playerType: adaptivePlayer.current.getActivePlayerType(),
          targetVolume: result.decision.suggestedVolume,
          action: result.decision.action,
        });
        
        const adaptSuccess = await adaptivePlayer.current.adaptPlayback(result.decision);
        
        if (adaptSuccess) {
          console.log('✅ Playback adapted successfully');
        } else {
          console.warn('⚠️ Playback adaptation returned false');
        }
      } catch (playbackError) {
        console.warn('❌ Failed to adapt playback:', playbackError);
      }

    } catch (error) {
      console.error('❌ Vibe check failed:', error);
      setVibeState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Vibe check failed',
      }));
    } finally {
      setIsProcessing(false);
      console.log('🏁 Vibe check cycle completed');
    }
  }, [stats, isProcessing, lastVibeCheck]);

  // Start/stop vibe checking
  const toggleVibeCheck = useCallback(async () => {
    if (isActive) {
      // Stop vibe checking
      stopCapture();
      if (vibeCheckInterval.current) {
        clearInterval(vibeCheckInterval.current);
        vibeCheckInterval.current = null;
      }
      setVibeState(prev => ({
        ...prev,
        isActive: false,
        decision: null,
      }));
    } else {
      // Start vibe checking
      try {
        await startCapture();
        
        // Load default playlist for adaptive player first
        console.log('🎵 Loading default playlist...');
        await adaptivePlayer.current.loadLocalPlaylist(DEFAULT_PLAYLIST);
        
        // Start periodic vibe checks
        console.log('🎯 Starting vibe detection with 2-second intervals...');
        vibeCheckInterval.current = setInterval(performVibeCheckCycle, 2000);
        
        // Perform an immediate vibe check to get started
        setTimeout(() => {
          if (stats) {
            console.log('🚀 Performing initial vibe check...');
            performVibeCheckCycle();
          }
        }, 1000);
        
      } catch (error) {
        console.error('Failed to start vibe check:', error);
        setVibeState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to start vibe check',
        }));
      }
    }
  }, [isActive, startCapture, stopCapture, performVibeCheckCycle]);

  // Test Spotify connection
  const testSpotify = useCallback(async () => {
    try {
      const token = prompt('Enter Spotify access token (for testing):');
      if (!token) return;
      
      const success = await adaptivePlayer.current.initializeSpotify(token);
      if (success) {
        alert('Spotify connected successfully! Adaptive player will now prefer Spotify.');
      } else {
        alert('Failed to connect to Spotify. Using local player as fallback.');
      }
    } catch (error) {
      console.error('Spotify test failed:', error);
      alert('Spotify test failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }, []);

  // Test ElevenLabs TTS
  const testTTS = useCallback(async () => {
    try {
      setIsProcessing(true);
      const testText = "Hello! This is a test of the text-to-speech system.";
      
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testText }),
      });
      
      if (!response.ok) {
        throw new Error(`TTS test failed: ${response.status}`);
      }
      
      const audioBuffer = await response.arrayBuffer();
      await adaptivePlayer.current.playTTS(audioBuffer);
      
      alert('TTS test successful!');
    } catch (error) {
      console.error('TTS test failed:', error);
      alert('TTS test failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Extract event vibe from URL
  const extractEventVibe = useCallback(async () => {
    if (!eventUrl.trim()) return;

    setIsExtractingEvent(true);
    setUrlVibeError(null);
    setEventVibeData(null);

    try {
      console.log('🌐 Extracting event vibe from URL:', eventUrl);

      const response = await fetch('/api/extract-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: eventUrl.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to extract event data: ${response.status}`);
      }

      if (data.success && data.eventData) {
        console.log('✅ Event data extracted successfully:', data.eventData);
        setEventVibeData(data.eventData);
        setUrlVibeError(null);
      } else {
        throw new Error('No event data returned from API');
      }

    } catch (error) {
      console.error('❌ Failed to extract event vibe:', error);
      setUrlVibeError(error instanceof Error ? error.message : 'Failed to extract event data');
      setEventVibeData(null);
    } finally {
      setIsExtractingEvent(false);
    }
  }, [eventUrl]);

  // Apply extracted event vibe as current vibe
  const applyEventVibe = useCallback(() => {
    if (!eventVibeData) return;

    console.log('✨ Applying event vibe as current vibe:', eventVibeData);

    // Create a VibeDecision from the event data
    const eventVibeDecision = {
      vibeLabel: eventVibeData.vibeLabel,
      suggestedBPM: eventVibeData.suggestedBPM,
      suggestedVolume: eventVibeData.suggestedVolume,
      spokenTip: `Event vibe: ${eventVibeData.vibeDescription}`,
      action: 'keep' as const,
    };

    // Update the vibe state with the event vibe
    setVibeState(prev => ({
      ...prev,
      decision: eventVibeDecision,
    }));

    // Mark this as an AI decision since it came from Gemini
    setIsAIDecision(true);

    // Show success message
    console.log('🎉 Event vibe applied successfully!');

  }, [eventVibeData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (vibeCheckInterval.current) {
        clearInterval(vibeCheckInterval.current);
      }
      adaptivePlayer.current.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            DJBuddy Vibe Check
          </h1>
          <p className="text-gray-600 dark:text-gray-300 flex items-center justify-center gap-2">
            AI-powered webcam vibe analysis with music adaptation
            <PrivacyTooltip />
          </p>
        </div>

        <div className="grid xl:grid-cols-4 lg:grid-cols-3 gap-6">
          {/* Video Preview Column */}
          <div className="xl:col-span-1 lg:col-span-1">
            <div className="stats-card">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                Live Video
              </h2>
              
              <div className="relative mb-4">
                <video
                  ref={videoRef}
                  className="video-preview w-full h-48 bg-gray-100 dark:bg-gray-700"
                  autoPlay
                  muted
                  playsInline
                />
                <canvas
                  ref={canvasRef}
                  className="hidden"
                />
                
                {!hasPermission && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <div className="text-center text-gray-500 dark:text-gray-400">
                      <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                      </svg>
                      <div>Camera access needed</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Control Buttons */}
              <div className="space-y-2">
                <button
                  onClick={toggleVibeCheck}
                  disabled={isProcessing}
                  className={`control-button w-full ${
                    isActive ? 'control-button-danger' : 'control-button-primary'
                  }`}
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Analysing Vibe...
                    </span>
                  ) : isActive ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      Stop Vibe Check
                    </span>
                  ) : (
                    'Start Vibe Check'
                  )}
                </button>
                
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={testSpotify}
                    disabled={isProcessing}
                    className="control-button control-button-secondary text-xs"
                  >
                    Spotify
                  </button>
                  <button
                    onClick={testTTS}
                    disabled={isProcessing}
                    className="control-button control-button-secondary text-xs"
                  >
                    TTS
                  </button>
                  <button
                    onClick={() => {
                      if (stats && !isProcessing) {
                        console.log('🧪 Manual vibe check triggered');
                        performVibeCheckCycle();
                      }
                    }}
                    disabled={isProcessing || !stats}
                    className="control-button control-button-secondary text-xs"
                  >
                    Vibe
                  </button>
                </div>
              </div>

              {/* Error Display */}
              {vibeState.error && (
                <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg">
                  <div className="text-red-800 dark:text-red-200 text-sm">
                    {vibeState.error}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live Metrics Column */}
          <div className="xl:col-span-1 lg:col-span-1">
            <div className="stats-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Live Metrics
                </h2>
                {isActive && (
                  <div className="flex items-center gap-2 text-sm">
                    {isProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-500 border-t-transparent"></div>
                        <span className="text-blue-600 dark:text-blue-400">Analysing...</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-green-600 dark:text-green-400">Active</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              {stats ? (
                <div className="space-y-4">
                  <VibeMeter 
                    label="Brightness"
                    value={stats.avgBrightness}
                    type="brightness"
                  />
                  <VibeMeter 
                    label="Motion Level"
                    value={stats.motionLevel}
                    type="motion"
                  />
                  <VibeMeter 
                    label="Faces Detected"
                    value={stats.faces}
                    max={5}
                    type="faces"
                  />
                  <VibeMeter 
                    label="Smiles Detected"
                    value={stats.smiles}
                    max={5}
                    type="smiles"
                  />
                  
                  {/* Audio Metrics */}
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Audio Analysis {hasMicPermission ? '🎤' : '🔇'}
                    </div>
                    
                    {hasMicPermission ? (
                      <>
                        <VibeMeter 
                          label="Audio Volume"
                          value={stats.audioVolume || 0}
                          type="motion"
                        />
                        
                        <div className="mt-2 space-y-1">
                          <VibeMeter 
                            label="Audio Energy"
                            value={stats.audioEnergy || 0}
                            type="motion"
                          />
                          
                          <VibeMeter 
                            label="Noise Level"
                            value={stats.noiseLevel || 0}
                            type="brightness"
                          />
                          
                          <VibeMeter 
                            label="Speech Probability"
                            value={stats.speechProbability || 0}
                            type="faces"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-gray-500 dark:text-gray-400 py-2">
                        Microphone access required for audio analysis.
                        <br />
                        Using visual-only vibe detection.
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <div>
                        <div>Colour Temp:</div>
                        <div className="font-mono">{Math.round(stats.colorTempK)}K</div>
                      </div>
                      <div>
                        <div>Pitch:</div>
                        <div className="font-mono">{Math.round(stats.pitch)}Hz</div>
                      </div>
                      <div>
                        <div>Spectral:</div>
                        <div className="font-mono">{Math.round(stats.spectralCentroid)}Hz</div>
                      </div>
                      <div>
                        <div>Audio:</div>
                        <div className={hasMicPermission ? 'text-green-600' : 'text-red-500'}>
                          {hasMicPermission ? 'Active' : 'Disabled'}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs text-gray-400">
                          Debug: Vol={stats.audioVolume?.toFixed(3)}, Energy={stats.audioEnergy?.toFixed(3)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  {isActive ? 'Analysing...' : 'Start vibe check to see metrics'}
                </div>
              )}
            </div>
          </div>

          {/* Vibe Decision Column */}
          <div className="xl:col-span-1 lg:col-span-1">
            <div className="space-y-4">
              <div className="stats-card">
                <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                  Current Vibe
                </h2>
                <VibeDisplay 
                  decision={vibeState.decision} 
                  isAI={isAIDecision}
                />
              </div>

              {/* Audio Status */}
              <div className="stats-card">
                <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                  Audio Status
                </h2>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Local Player:</span>
                    <span className={audioPlaying ? 'text-green-600' : 'text-gray-500'}>
                      {audioPlaying ? 'Playing' : 'Stopped'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Active Player:</span>
                    <span className="text-gray-500">
                      {adaptivePlayer.current.getActivePlayerType().charAt(0).toUpperCase() + adaptivePlayer.current.getActivePlayerType().slice(1)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Last Check:</span>
                    <span className="text-gray-500">
                      {lastVibeCheck ? new Date(lastVibeCheck).toLocaleTimeString('en-GB', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        second: '2-digit',
                        timeZone: 'UTC'
                      }) : 'Never'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="stats-card">
                <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                  How It Works
                </h2>
                
                <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                  <p>• <strong>Party:</strong> High motion + multiple faces</p>
                  <p>• <strong>Chill:</strong> Low brightness + minimal motion</p>
                  <p>• <strong>Focused:</strong> Smiles + moderate motion</p>
                  <p>• <strong>Bored:</strong> Low engagement detected</p>
                </div>
              </div>
            </div>
          </div>

          {/* Weather Column */}
          <div className="xl:col-span-1 lg:col-span-3 xl:lg:col-span-1">
            <WeatherWidget />
          </div>
        </div>

        {/* URL Context Section */}
        <div className="mt-6">
          <div className="stats-card">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              🌐 Event URL Context
              <span className="text-xs px-2 py-1 bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300 rounded-full">
                Powered by Gemini
              </span>
            </h2>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={eventUrl}
                  onChange={(e) => setEventUrl(e.target.value)}
                  placeholder="Enter event URL (e.g., concert, festival, conference page)"
                  disabled={isExtractingEvent}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           placeholder-gray-500 dark:placeholder-gray-400
                           focus:ring-2 focus:ring-purple-500 focus:border-transparent
                           disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  onClick={extractEventVibe}
                  disabled={!eventUrl.trim() || isExtractingEvent}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 
                           text-white rounded-lg font-medium transition-colors
                           disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isExtractingEvent ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Analysing...
                    </>
                  ) : (
                    <>
                      🎯 Extract Vibe
                    </>
                  )}
                </button>
              </div>

              {urlVibeError && (
                <div className="p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg">
                  <div className="text-red-800 dark:text-red-200 text-sm">
                    {urlVibeError}
                  </div>
                </div>
              )}

              {eventVibeData && (
                <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 
                               border border-purple-200 dark:border-purple-700 rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {eventVibeData.eventTitle}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <div className={`vibe-label vibe-label-${eventVibeData.vibeLabel} text-xs`}>
                          {eventVibeData.vibeLabel.toUpperCase()}
                        </div>
                        <span className="text-xs px-2 py-1 bg-purple-100 text-purple-600 dark:bg-purple-800 dark:text-purple-300 rounded-full">
                          🌐 URL Event
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={applyEventVibe}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-lg
                               font-medium transition-colors flex items-center gap-1"
                    >
                      ✨ Apply Vibe
                    </button>
                  </div>
                  
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                    {eventVibeData.vibeDescription}
                  </p>
                  
                  <div className="space-y-2 text-sm">
                    {eventVibeData.eventDate && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Date:</span>
                        <span className="ml-2 font-medium">{eventVibeData.eventDate}</span>
                      </div>
                    )}
                    {eventVibeData.eventLocation && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Location:</span>
                        <span className="ml-2 font-medium">{eventVibeData.eventLocation}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-500 dark:text-gray-400">
                💡 Enter any event URL (concerts, festivals, conferences, parties) and we'll analyse the vibe using AI
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export wrapped component to prevent hydration issues
export default function VibeCheckPage() {
  return (
    <ClientOnly>
      <VibeCheckPageInner />
    </ClientOnly>
  );
}
