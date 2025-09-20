'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { FlickeringGrid } from '@/components/ui/flickering-grid';
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
        <span className="text-sm text-gray-700">
          {type === 'faces' || type === 'smiles' ? Math.round(value) : value.toFixed(2)}
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${
            type === 'brightness' ? 'bg-yellow-500' :
            type === 'motion' ? 'bg-blue-500' :
            type === 'faces' ? 'bg-green-500' :
            'bg-pink-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Privacy tooltip component
function PrivacyTooltip() {
  return (
    <div className="group relative">
      <svg 
        className="w-4 h-4 text-gray-500 hover:text-gray-700 cursor-help" 
        fill="currentColor" 
        viewBox="0 0 20 20"
      >
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-gray-900 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
        All processing is done locally in your browser
      </div>
    </div>
  );
}

// Component for displaying current vibe
function VibeDisplay({ decision }: { decision: VibeDecision }) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className={`inline-block px-4 py-2 rounded-full text-sm font-semibold vibe-label vibe-label-${decision.vibe}`}>
          {decision.vibe.toUpperCase()}
        </div>
      </div>
      <p className="text-sm text-gray-700 text-center leading-relaxed">
        {decision.reasoning}
      </p>
      {decision.musicSuggestion && (
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="text-xs text-blue-600 font-medium mb-1">🎵 Suggested Music</div>
          <div className="text-sm text-blue-800">{decision.musicSuggestion}</div>
        </div>
      )}
    </div>
  );
}

// Component for no vibe state
function NoVibeDisplay() {
  return (
    <div className="text-center py-8 text-gray-700">
      <div className="text-gray-700">
        Start a vibe check to see analysis
      </div>
    </div>
  );
}

// Weather widget component
function WeatherWidget() {
  const {
    data: weather,
    loading: weatherLoading,
    error: weatherError
  } = useWeather();

  if (weatherLoading) {
    return (
      <div className="stats-card">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">Weather</h2>
        <div className="text-center py-8 text-gray-700">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-2"></div>
          <div>Loading weather...</div>
        </div>
      </div>
    );
  }

  if (weatherError) {
    return (
      <div className="stats-card">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">Weather</h2>
        <div className="text-center py-8 text-gray-700">
          <div className="text-red-600">Failed to load weather</div>
        </div>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="stats-card">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">Weather</h2>
        <div className="text-center py-8 text-gray-700">
          <div>No weather data</div>
        </div>
      </div>
    );
  }

  return (
    <div className="stats-card">
      <h2 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
        🌤️ Weather
        <span className="text-xs text-gray-600">{weather.location}</span>
      </h2>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-gray-900">{Math.round(weather.temp)}°C</div>
            <div className="text-sm text-gray-600 capitalize">{weather.description}</div>
          </div>
          <div className="text-right text-sm text-gray-600 space-y-1">
            <div>Feels like {Math.round(weather.feels_like)}°C</div>
            <div>Humidity: {weather.humidity}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main vibe check page component
function VibeCheckPageInner() {
  // URL parameters
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode');

  // Core state
  const [isActive, setIsActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<RoomStats | null>(null);
  const [vibeState, setVibeState] = useState<VibeCheckState>({
    isAnalyzing: false,
    decision: null,
    error: null
  });

  // Event URL state
  const [eventUrl, setEventUrl] = useState('');
  const [isExtractingEvent, setIsExtractingEvent] = useState(false);
  const [eventVibeData, setEventVibeData] = useState<any>(null);
  const [urlVibeError, setUrlVibeError] = useState<string | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Weather data
  const {
    data: weather,
    loading: weatherLoading,
    error: weatherError
  } = useWeather();

  // Vibe sensors
  const {
    hasPermission,
    hasMicPermission,
    startAnalysis,
    stopAnalysis,
    currentStats
  } = useVibeSensors(videoRef, canvasRef);

  // Update stats when sensors change
  useEffect(() => {
    if (currentStats) {
      setStats(currentStats);
    }
  }, [currentStats]);

  // Vibe check cycle
  const performVibeCheckCycle = useCallback(async () => {
    if (!stats || isProcessing) return;

    setIsProcessing(true);
    setVibeState(prev => ({ ...prev, isAnalyzing: true, error: null }));

    try {
      console.log('🎯 Performing vibe check with stats:', stats);
      const decision = await performVibeCheck(stats);
      console.log('✅ Vibe decision:', decision);
      
      setVibeState({
        isAnalyzing: false,
        decision,
        error: null
      });
    } catch (error) {
      console.error('❌ Vibe check failed:', error);
      setVibeState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: error instanceof Error ? error.message : 'Failed to analyze vibe'
      }));
    } finally {
      setIsProcessing(false);
    }
  }, [stats, isProcessing]);

  // Toggle vibe check
  const toggleVibeCheck = useCallback(async () => {
    if (isActive) {
      console.log('🛑 Stopping vibe check');
      stopAnalysis();
      setIsActive(false);
      setStats(null);
    } else {
      console.log('▶️ Starting vibe check');
      const success = await startAnalysis();
      if (success) {
        setIsActive(true);
      }
    }
  }, [isActive, startAnalysis, stopAnalysis]);

  // Extract event vibe
  const extractEventVibe = useCallback(async () => {
    if (!eventUrl.trim()) return;
    
    setIsExtractingEvent(true);
    setUrlVibeError(null);
    
    try {
      const response = await fetch('/api/extract-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: eventUrl.trim() })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract event vibe');
      }
      
      setEventVibeData(data);
    } catch (error) {
      console.error('❌ Event extraction failed:', error);
      setUrlVibeError(error instanceof Error ? error.message : 'Failed to extract event vibe');
    } finally {
      setIsExtractingEvent(false);
    }
  }, [eventUrl]);

  // Apply event vibe
  const applyEventVibe = useCallback(() => {
    if (!eventVibeData) return;
    
    console.log('🌐 Applying event vibe:', eventVibeData);
    setVibeState({
      isAnalyzing: false,
      decision: {
        vibe: eventVibeData.vibeLabel,
        reasoning: `Based on event analysis: ${eventVibeData.reasoning}`,
        confidence: 0.8,
        musicSuggestion: eventVibeData.musicSuggestion
      },
      error: null
    });
  }, [eventVibeData]);

  return (
    <div 
      className="min-h-screen p-4 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)'
      }}
    >
      <FlickeringGrid 
        className="absolute inset-0 z-0"
        squareSize={4}
        gridGap={6}
        color="#6B7280"
        maxOpacity={0.5}
        flickerChance={0.1}
      />
      
      <div className="max-w-6xl mx-auto bg-black bg-opacity-20 backdrop-blur-lg rounded-3xl border border-white border-opacity-10 p-8 shadow-2xl relative z-10">
        {/* Header */}
        <div className="text-left mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            MusicBuddy Vibe Check
          </h1>
          <p className="text-white text-opacity-80 flex items-center gap-2">
            AI-powered webcam vibe analysis with music adaptation
            <PrivacyTooltip />
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
          {/* Box 1: Video */}
          <div className="lg:col-span-1 xl:col-span-1">
            <div className="stats-card">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">
                Live Video
              </h2>
              
              <div className="relative mb-4">
                <video
                  ref={videoRef}
                  className="video-preview w-full h-48 bg-gray-100 dark:bg-gray-700 rounded-lg"
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
                    <div className="text-center text-gray-700">
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
                
                <div className="flex justify-center">
                  <button
                    onClick={() => {
                      if (stats && !isProcessing) {
                        console.log('🧪 Manual vibe check triggered');
                        performVibeCheckCycle();
                      }
                    }}
                    disabled={isProcessing || !stats}
                    className="control-button control-button-secondary text-xs px-4"
                  >
                    Manual Vibe Check
                  </button>
                </div>
              </div>

              {/* Error Display */}
              {vibeState.error && (
                <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                  <div className="text-red-800 text-sm">
                    {vibeState.error}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Box 2: Weather, Audio & Live Metrics Combined */}
          <div className="lg:col-span-1 xl:col-span-1">
            <div className="stats-card">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">
                System Status
              </h2>

              {/* Weather Section */}
              <div className="mb-6">
                <h3 className="text-md font-medium mb-3 text-gray-800 flex items-center gap-2">
                  🌤️ Weather
                </h3>
                {weather ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{weather.location}</span>
                      <span className="text-lg font-bold text-gray-900">{Math.round(weather.temp)}°C</span>
                    </div>
                    <div className="text-sm text-gray-600">{weather.description}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <div>Feels like: {Math.round(weather.feels_like)}°C</div>
                      <div>Humidity: {weather.humidity}%</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">Loading weather...</div>
                )}
              </div>

              {/* Audio Status Section */}
              <div className="mb-6">
                <h3 className="text-md font-medium mb-3 text-gray-800 flex items-center gap-2">
                  🎵 Audio Status
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Local Player:</span>
                    <span className="text-gray-900">Stopped</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Active Player:</span>
                    <span className="text-gray-900">None</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Check:</span>
                    <span className="text-gray-900">Never</span>
                  </div>
                </div>
              </div>

              {/* Live Metrics Section */}
              <div>
                <h3 className="text-md font-medium mb-3 text-gray-800 flex items-center gap-2">
                  📊 Live Metrics
                  <div className="flex items-center gap-1 text-xs">
                    {!isActive ? (
                      <>
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        <span className="text-gray-600">Inactive</span>
                      </>
                    ) : hasMicPermission ? (
                      <>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <span className="text-blue-600">Audio + Video</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-green-600">Active</span>
                      </>
                    )}
                  </div>
                </h3>

                {stats ? (
                  <div className="space-y-2">
                    <VibeMeter label="Brightness" value={stats.brightness} type="brightness" />
                    <VibeMeter label="Motion" value={stats.motion} type="motion" />
                    <VibeMeter label="Faces" value={stats.faces} max={10} type="faces" />
                    <VibeMeter label="Smiles" value={stats.smiles} max={stats.faces || 1} type="smiles" />
                    
                    {stats.audioLevel !== undefined && (
                      <VibeMeter label="Audio Level" value={stats.audioLevel} type="motion" />
                    )}
                  </div>
                ) : (
                  <div className="text-center text-gray-700 py-4">
                    <div className="text-sm text-gray-700">
                      Start vibe check to see metrics
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Box 3: Event URL (Small Box) */}
          <div className="lg:col-span-2 xl:col-span-1">
            <div className="stats-card">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                🌐 Event URL
                <span className="text-xs px-2 py-1 bg-purple-100 text-purple-600 rounded-full">
                  Gemini
                </span>
              </h2>
              
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={eventUrl}
                    onChange={(e) => setEventUrl(e.target.value)}
                    placeholder="Paste event URL here..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  />
                </div>
                <button
                  onClick={extractEventVibe}
                  disabled={!eventUrl.trim() || isExtractingEvent}
                  className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 
                           text-white rounded-lg font-medium transition-colors text-sm
                           disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isExtractingEvent ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Extracting...
                    </>
                  ) : (
                    <>
                      🔍 Extract Vibe
                    </>
                  )}
                </button>

                {urlVibeError && (
                  <div className="p-3 bg-red-100 border border-red-300 rounded-lg">
                    <div className="text-red-800 text-sm">
                      {urlVibeError}
                    </div>
                  </div>
                )}

                {eventVibeData && (
                  <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`vibe-label vibe-label-${eventVibeData.vibeLabel} inline-block text-xs`}>
                        {eventVibeData.vibeLabel.toUpperCase()}
                      </div>
                      <button
                        onClick={applyEventVibe}
                        className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded
                                 font-medium transition-colors"
                      >
                        ✨ Apply
                      </button>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {eventVibeData.reasoning}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Box 4: Current Vibe Analysis */}
          <div className="lg:col-span-2 xl:col-span-1">
            <div className="stats-card">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">
                Current Vibe
              </h2>
              {vibeState.decision ? <VibeDisplay decision={vibeState.decision} /> : <NoVibeDisplay />}
              
              {/* How It Works */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h3 className="text-md font-medium mb-3 text-gray-800">
                  How It Works
                </h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>• <strong>Party:</strong> High motion + multiple faces</p>
                  <p>• <strong>Chill:</strong> Low brightness + minimal motion</p>
                  <p>• <strong>Focused:</strong> Smiles + moderate motion</p>
                  <p>• <strong>Bored:</strong> Low engagement detected</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main page component with client-side rendering
export default function VibeCheckPage() {
  return (
    <ClientOnly>
      <VibeCheckPageInner />
    </ClientOnly>
  );
}
