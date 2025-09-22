'use client';

import { useState, useEffect, useCallback, useRef, useId } from 'react';
import { FlickeringGrid } from '@/components/ui/flickering-grid';
import { useVibeSensors } from '@/lib/vibe/useVibeSensors';
import { performVibeCheck } from '@/lib/vibe/interpretVibe';
import { getLocalPlayer, DEFAULT_PLAYLIST, type AudioTrack, type LocalPlayerState } from '@/lib/audio/localPlayer';
import { getAdaptivePlayer } from '@/lib/audio/adaptivePlayer';
import { useWeather } from '@/lib/weather/useWeather';
import {
  RoomStats,
  VibeDecision,
  VibeCheckState,
  AgnoMusicResponse,
  RoomStatsSample,
  RoomStatsWindow,
} from '@/lib/types/vibe';

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

type GeneratedTrack = AudioTrack & {
  style?: string;
  description?: string;
  duration?: number;
  createdAt: number;
  source: 'elevenlabs' | 'fallback';
  note?: string;
};

function formatSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '0:00';
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.max(0, Math.floor(totalSeconds % 60));
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const MIN_STYLE_LOCK_MS = 60_000;
const MIN_CAPTURE_DURATION_MS = 5_000;
const METRICS_HISTORY_RETENTION_MS = 15_000;

type StatsHistoryEntry = RoomStatsSample;

function cloneRoomStats(stats: RoomStats): RoomStats {
  return {
    ...stats,
    motionZones: [...stats.motionZones],
    dominantColors: [...stats.dominantColors],
  };
}

function getModeFromMap<T extends string>(counts: Map<T, number>, fallback: T): T {
  if (counts.size === 0) {
    return fallback;
  }

  let selected = fallback;
  let highest = -1;

  counts.forEach((count, value) => {
    if (count > highest) {
      selected = value;
      highest = count;
    }
  });

  return selected;
}

function computeAveragedStats(samples: RoomStats[]): RoomStats {
  if (samples.length === 0) {
    throw new Error('Cannot compute average of empty samples');
  }

  const latest = samples[samples.length - 1];
  const count = samples.length;

  const totals = {
    avgBrightness: 0,
    colorTempK: 0,
    motionLevel: 0,
    crowdDensity: 0,
    colorVariance: 0,
    audioVolume: 0,
    audioEnergy: 0,
    noiseLevel: 0,
    speechProbability: 0,
    pitch: 0,
    spectralCentroid: 0,
  };

  const motionZoneTotals = new Array(latest.motionZones.length).fill(0);
  let facesSum = 0;
  let facesSamples = 0;
  let smilesSum = 0;
  let smilesSamples = 0;
  const styleCounts = new Map<RoomStats['styleIndicator'], number>();
  const lightingCounts = new Map<RoomStats['lightingPattern'], number>();
  const colorCounts = new Map<string, number>();
  let dominantSampleSize = latest.dominantColors.length || 1;
  let fallbackColors = [...latest.dominantColors];

  for (const sample of samples) {
    totals.avgBrightness += sample.avgBrightness;
    totals.colorTempK += sample.colorTempK;
    totals.motionLevel += sample.motionLevel;
    totals.crowdDensity += sample.crowdDensity;
    totals.colorVariance += sample.colorVariance;
    totals.audioVolume += sample.audioVolume;
    totals.audioEnergy += sample.audioEnergy;
    totals.noiseLevel += sample.noiseLevel;
    totals.speechProbability += sample.speechProbability;
    totals.pitch += sample.pitch;
    totals.spectralCentroid += sample.spectralCentroid;

    for (let i = 0; i < motionZoneTotals.length; i += 1) {
      const value = sample.motionZones[i] ?? sample.motionZones[sample.motionZones.length - 1] ?? 0;
      motionZoneTotals[i] += value;
    }

    if (typeof sample.faces === 'number') {
      facesSum += sample.faces;
      facesSamples += 1;
    }

    if (typeof sample.smiles === 'number') {
      smilesSum += sample.smiles;
      smilesSamples += 1;
    }

    styleCounts.set(sample.styleIndicator, (styleCounts.get(sample.styleIndicator) ?? 0) + 1);
    lightingCounts.set(sample.lightingPattern, (lightingCounts.get(sample.lightingPattern) ?? 0) + 1);

    if (sample.dominantColors.length > 0) {
      fallbackColors = sample.dominantColors;
      dominantSampleSize = sample.dominantColors.length;
      for (const color of sample.dominantColors) {
        colorCounts.set(color, (colorCounts.get(color) ?? 0) + 1);
      }
    }
  }

  const averaged: RoomStats = {
    avgBrightness: totals.avgBrightness / count,
    colorTempK: totals.colorTempK / count,
    motionLevel: totals.motionLevel / count,
    faces: facesSamples > 0 ? Math.round(facesSum / facesSamples) : latest.faces,
    smiles: smilesSamples > 0 ? Math.round(smilesSum / smilesSamples) : latest.smiles,
    motionZones: motionZoneTotals.map(total => total / count),
    crowdDensity: totals.crowdDensity / count,
    styleIndicator: getModeFromMap(styleCounts, latest.styleIndicator),
    dominantColors: colorCounts.size > 0
      ? Array.from(colorCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, Math.max(1, dominantSampleSize))
          .map(([color]) => color)
      : [...fallbackColors],
    colorVariance: totals.colorVariance / count,
    lightingPattern: getModeFromMap(lightingCounts, latest.lightingPattern),
    audioVolume: totals.audioVolume / count,
    audioEnergy: totals.audioEnergy / count,
    noiseLevel: totals.noiseLevel / count,
    speechProbability: totals.speechProbability / count,
    pitch: totals.pitch / count,
    spectralCentroid: totals.spectralCentroid / count,
  };

  return averaged;
}

function cloneFallbackTrack(track: AudioTrack): AudioTrack {
  return { ...track };
}

function selectFallbackTrack(style?: string, vibeLabel?: string): AudioTrack {
  const key = (style || vibeLabel || '').toLowerCase();

  if (/upbeat|electronic|dynamic|party|bored/.test(key)) {
    return cloneFallbackTrack(DEFAULT_PLAYLIST[1]);
  }

  if (/focus|ambient|professional/.test(key)) {
    return cloneFallbackTrack(DEFAULT_PLAYLIST[2]);
  }

  return cloneFallbackTrack(DEFAULT_PLAYLIST[0]);
}

function GeneratedTrackWidget({
  track,
  playbackState,
  isPlaying,
  onPlay,
  onPause,
  onReset,
  error,
}: {
  track: GeneratedTrack | null;
  playbackState: LocalPlayerState;
  isPlaying: boolean;
  onPlay: () => Promise<void>;
  onPause: () => Promise<void>;
  onReset: () => Promise<void>;
  error: string | null;
}) {
  const progress = track && playbackState.duration
    ? Math.min(100, (playbackState.currentTime / playbackState.duration) * 100)
    : 0;

  return (
    <div className="stats-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          🎧 AI Track Player
        </h2>
        {track && (
          <span className={`text-xs px-2 py-1 rounded-full ${
            track.source === 'fallback'
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200'
              : 'bg-blue-100 text-blue-600 dark:bg-blue-900/60 dark:text-blue-200'
          }`}>
            {track.source === 'fallback' ? 'Fallback Playlist' : 'ElevenLabs'}
          </span>
        )}
      </div>

      {track ? (
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {track.name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-2 mt-1">
              {track.style && (
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full capitalize">
                  {track.style}
                </span>
              )}
              <span>
                Generated at {new Date(track.createdAt).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
            {track.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                {track.description}
              </p>
            )}
            {track.note && (
              <p className="text-xs text-amber-600 dark:text-amber-300 mt-1 leading-relaxed">
                {track.note}
              </p>
            )}
          </div>

          <div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>{formatSeconds(playbackState.currentTime)}</span>
              <span>{formatSeconds(playbackState.duration)}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { void onPlay(); }}
              disabled={isPlaying || !track.url}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-md text-sm transition-colors"
            >
              ▶️ Play
            </button>
            <button
              onClick={() => { void onPause(); }}
              disabled={!isPlaying}
              className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-gray-800 dark:text-gray-200 rounded-md text-sm transition-colors"
            >
              ⏸️ Pause
            </button>
            <button
              onClick={() => { void onReset(); }}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md text-sm transition-colors"
            >
              🔄 Reset
            </button>
            <a
              href={track.url}
              download={`${track.id || 'ai-track'}.mp3`}
              className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-md text-sm transition-colors"
            >
              ⬇️ Download
            </a>
          </div>

          {error && (
            <div className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
              ⚠️ {error}
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-gray-600 dark:text-gray-300">
          Generate a vibe check to hear a freshly composed ElevenLabs track.
        </div>
      )}
    </div>
  );
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
  const tooltipId = useId();

  return (
    <span className="relative inline-flex group">
      <button
        type="button"
        aria-describedby={tooltipId}
        aria-label="Learn about privacy"
        className="w-4 h-4 text-gray-500 hover:text-gray-700 cursor-help flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      >
        <svg
          className="w-full h-full"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-gray-900 rounded-lg opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10"
      >
        All processing is done locally in your browser
      </span>
    </span>
  );
}

// Component for displaying current vibe
function VibeDisplay({ decision }: { decision: VibeDecision }) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className={`inline-block px-4 py-2 rounded-full text-sm font-semibold vibe-label vibe-label-${decision.vibeLabel}`}>
          {decision.vibeLabel.toUpperCase()}
        </div>
        </div>
      <p className="text-sm text-gray-700 text-center leading-relaxed">
        {decision.spokenTip}
      </p>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="text-center">
          <div className="text-xs text-gray-600">Suggested BPM</div>
          <div className="text-lg font-bold text-gray-900">{decision.suggestedBPM}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-600">Volume</div>
          <div className="text-lg font-bold text-gray-900">{Math.round(decision.suggestedVolume * 100)}%</div>
        </div>
      </div>
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
    isLoading: weatherLoading,
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
            <div className="text-2xl font-bold text-gray-900">{Math.round(weather.temperature)}°C</div>
            <div className="text-sm text-gray-600 capitalize">{weather.description}</div>
          </div>
          <div className="text-right text-sm text-gray-600 space-y-1">
            <div>Feels like {Math.round(weather.feelsLike)}°C</div>
            <div>Humidity: {weather.humidity}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main vibe check page component
function VibeCheckPageInner() {
  // Core state
  const [isActive, setIsActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<RoomStats | null>(null);
  const [vibeState, setVibeState] = useState<{
    isAnalyzing: boolean;
    decision: VibeDecision | null;
    error: string | null;
  }>({
    isAnalyzing: false,
    decision: null,
    error: null
  });

  const [latestGeneratedTrack, setLatestGeneratedTrack] = useState<GeneratedTrack | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [localPlaybackState, setLocalPlaybackState] = useState<LocalPlayerState>(() => getLocalPlayer().getCurrentState());

  // Event URL state
  const [eventUrl, setEventUrl] = useState('');
  const [isExtractingEvent, setIsExtractingEvent] = useState(false);
  const [eventVibeData, setEventVibeData] = useState<any>(null);
  const [urlVibeError, setUrlVibeError] = useState<string | null>(null);

  const localPlayer = useRef(getLocalPlayer());
  const adaptivePlayer = useRef(getAdaptivePlayer());
  const generatedTrackUrls = useRef<string[]>([]);
  const latestStatsRef = useRef<RoomStats | null>(null);
  const lastVibeCheckRef = useRef<number>(0);
  const styleLockRef = useRef<number>(0);
  const lastStyleRef = useRef<string | null>(null);
  const captureStartedAtRef = useRef<number | null>(null);
  const captureMetricsHistoryRef = useRef<StatsHistoryEntry[]>([]);


  // Weather data
  const {
    data: weather,
    isLoading: weatherLoading,
    error: weatherError
  } = useWeather();

  // Vibe sensors
  const {
    isActive: sensorActive,
      hasPermission,
    hasMicPermission,
      error: sensorError,
    stats: sensorStats,
    videoRef: hookVideoRef,
    canvasRef: hookCanvasRef,
    startCapture,
    stopCapture
  } = useVibeSensors();

  // Update stats when sensors change
  useEffect(() => {
    if (sensorStats) {
      const typedStats = sensorStats as RoomStats;
      latestStatsRef.current = typedStats;
      setStats(typedStats);

      if (captureStartedAtRef.current !== null) {
        const now = Date.now();
        captureMetricsHistoryRef.current.push({
          timestamp: now,
          stats: cloneRoomStats(typedStats),
        });

        const cutoff = now - METRICS_HISTORY_RETENTION_MS;
        captureMetricsHistoryRef.current = captureMetricsHistoryRef.current.filter(
          entry => entry.timestamp >= cutoff,
        );
      }
    }
  }, [sensorStats]);

  // Update error state
  useEffect(() => {
    if (sensorError) {
      setVibeState(prev => ({ ...prev, error: sensorError }));
    }
  }, [sensorError]);

  useEffect(() => {
    localPlayer.current.updateCallbacks({
      onTrackChange: () => {
        setLocalPlaybackState(localPlayer.current.getCurrentState());
      },
      onPlayStateChange: (isPlaying) => {
        setAudioPlaying(isPlaying);
      },
      onError: (error) => {
        console.warn('Local player error:', error);
        setPlayerError(error);
      },
    });

    adaptivePlayer.current.updateCallbacks({
      onPlayerChange: (playerType) => {
        console.log('Player changed to:', playerType);
      },
      onPlayStateChange: (isPlaying) => {
        setAudioPlaying(isPlaying);
      },
      onTrackChange: () => {
        setLocalPlaybackState(localPlayer.current.getCurrentState());
      },
      onError: (error) => {
        console.warn('Adaptive player error:', error);
        setPlayerError(error);
      },
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setLocalPlaybackState(localPlayer.current.getCurrentState());
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const ensureStats = useCallback((override?: RoomStats | null): RoomStats | null => {
    const active = override ?? stats ?? latestStatsRef.current;
    if (active) {
      latestStatsRef.current = active;
      return active;
    }

    const fallback: RoomStats = {
      avgBrightness: 0.5,
      colorTempK: 4500,
      motionLevel: 0.2,
      faces: 0,
      smiles: 0,
      motionZones: [0, 0, 0, 0, 0],
      crowdDensity: 0.1,
      styleIndicator: 'casual',
      dominantColors: ['#444444'],
      colorVariance: 0.1,
      lightingPattern: 'steady',
      audioVolume: 0.2,
      audioEnergy: 0.2,
      noiseLevel: 0.15,
      speechProbability: 0.1,
      pitch: 220,
      spectralCentroid: 3500,
    };

    latestStatsRef.current = fallback;
    return fallback;
  }, [stats]);

  const applyFallbackPlayback = useCallback(
    async (fallbackPlan: NonNullable<AgnoMusicResponse['fallback']>, decision: VibeDecision) => {
      const now = Date.now();
      const baseTrack = selectFallbackTrack(fallbackPlan.suggestedStyle, decision?.vibeLabel);

      const fallbackTrack: GeneratedTrack = {
        ...baseTrack,
        id: `fallback-${baseTrack.id}-${now}`,
        name: baseTrack.name ?? 'Fallback vibe track',
        style: fallbackPlan.suggestedStyle ?? baseTrack.genre ?? decision.vibeLabel,
        description: `Local fallback track engaged to maintain the ${fallbackPlan.suggestedStyle ?? decision.vibeLabel} atmosphere.`,
        duration: undefined,
        createdAt: now,
        source: 'fallback',
        note: `Instrumental fallback engaged: ${fallbackPlan.reason}`,
      };

      console.info('🎼 Engaging fallback playlist', {
        reason: fallbackPlan.reason,
        style: fallbackTrack.style,
      });

      let playbackStarted = false;
      try {
        const loaded = await localPlayer.current.loadPlaylist([fallbackTrack]);
        if (!loaded) {
          console.warn('Fallback track queued but local player refused to load');
        } else {
          playbackStarted = await localPlayer.current.play();
          if (!playbackStarted) {
            console.warn(
              'Fallback track loaded but playback did not start automatically; user interaction may be required'
            );
          }
        }
      } catch (playError) {
        console.warn('Failed to stage fallback track for playback:', playError);
      } finally {
        setLocalPlaybackState(localPlayer.current.getCurrentState());
      }

      generatedTrackUrls.current.forEach((url) => URL.revokeObjectURL(url));
      generatedTrackUrls.current = [];

      setLatestGeneratedTrack(fallbackTrack);
      lastStyleRef.current = fallbackTrack.style || decision.vibeLabel;
      styleLockRef.current = now + MIN_STYLE_LOCK_MS;
      if (playbackStarted) {
        setPlayerError(null);
      }
    },
    [
      localPlayer,
      setLocalPlaybackState,
      setLatestGeneratedTrack,
      generatedTrackUrls,
      lastStyleRef,
      styleLockRef,
      setPlayerError,
    ]
  );

  // Vibe check cycle
  const performVibeCheckCycle = useCallback(async (
    options?: { statsOverride?: RoomStats | null; force?: boolean }
  ) => {
    if (isProcessing && !options?.force) {
      return;
    }

    const preWarmupNow = Date.now();
    let lockActive = styleLockRef.current > preWarmupNow;

    if (!options?.force) {
      const minimumGap = lockActive ? 8000 : 3000;
      if (preWarmupNow - lastVibeCheckRef.current < minimumGap) {
        return;
      }
    }

    setIsProcessing(true);

    try {
      const captureStartedAt = captureStartedAtRef.current;
      if (captureStartedAt) {
        const elapsed = Date.now() - captureStartedAt;
        if (elapsed < MIN_CAPTURE_DURATION_MS) {
          const waitMs = MIN_CAPTURE_DURATION_MS - elapsed;
          console.log('⏳ Waiting for vibe capture warmup before contacting AgentOS:', `${waitMs}ms remaining`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }

      const analysisTimestamp = Date.now();
      lockActive = styleLockRef.current > analysisTimestamp;

      if (!options?.force) {
        const minimumGap = lockActive ? 8000 : 3000;
        if (analysisTimestamp - lastVibeCheckRef.current < minimumGap) {
          return;
        }
      }

      if (lockActive) {
        console.log('🔒 Style lock active – holding current style until', new Date(styleLockRef.current).toLocaleTimeString());
      }

      const activeStats = ensureStats(options?.statsOverride);
      if (!activeStats) {
        console.warn('Skipping vibe check: no stats available');
        return;
      }

      if (captureStartedAtRef.current !== null) {
        captureMetricsHistoryRef.current.push({
          timestamp: analysisTimestamp,
          stats: cloneRoomStats(activeStats),
        });
      }

      const windowEntries = captureMetricsHistoryRef.current.filter(
        entry => analysisTimestamp - entry.timestamp <= MIN_CAPTURE_DURATION_MS,
      );

      const windowSamples = windowEntries.length > 0
        ? windowEntries.map(entry => entry.stats)
        : [cloneRoomStats(activeStats)];

      const statsForAgent = computeAveragedStats(windowSamples);

      const statsWindow: RoomStatsWindow | undefined = windowEntries.length > 0
        ? {
            start: windowEntries[0].timestamp,
            end: windowEntries[windowEntries.length - 1].timestamp,
            sampleCount: windowEntries.length,
            averagedStats: cloneRoomStats(statsForAgent),
            latestStats: cloneRoomStats(activeStats),
          }
        : undefined;

      captureMetricsHistoryRef.current = captureMetricsHistoryRef.current.filter(
        entry => analysisTimestamp - entry.timestamp <= METRICS_HISTORY_RETENTION_MS,
      );

      lastVibeCheckRef.current = analysisTimestamp;

      setVibeState(prev => ({ ...prev, isAnalyzing: true, error: null }));
      setPlayerError(null);

      console.log('🎯 Performing vibe check with stats:', activeStats);
      if (statsWindow) {
        console.log('📊 Aggregated stats window', {
          sampleCount: statsWindow.sampleCount,
          start: new Date(statsWindow.start).toISOString(),
          end: new Date(statsWindow.end).toISOString(),
          averaged: statsWindow.averagedStats,
        });
      }

      const vibeResult = await performVibeCheck(activeStats);
      const decision = vibeResult.decision;

      if (vibeResult.audioBuffer) {
        try {
          await adaptivePlayer.current.playTTS(vibeResult.audioBuffer);
        } catch (ttsError) {
          console.warn('Adaptive player TTS failed, using local player:', ttsError);
          await localPlayer.current.playTTS(vibeResult.audioBuffer);
        }
      }

      const weatherSnapshot = weather
        ? {
            location: weather.location,
            description: weather.description,
            temperature: weather.temperature,
            feelsLike: weather.feelsLike,
            humidity: weather.humidity,
            uvIndex: weather.uvIndex,
            cloudiness: weather.cloudiness,
            timestamp: weather.timestamp,
          }
        : undefined;

      // Call ElevenLabs agent via our API to generate music
      const agentResponse = await fetch('/api/generate-vibe-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stats: statsForAgent,
          statsWindow,
          decision,
          weather: weatherSnapshot,
          context: {
            timestamp: analysisTimestamp,
            sessionId: 'vibe-check-session',
            previousVibe: vibeState.decision?.vibeLabel,
            previousStyle: lastStyleRef.current ?? undefined,
            styleLockExpiresAt: styleLockRef.current || undefined,
          },
        }),
      });

      if (!agentResponse.ok) {
        throw new Error(`API responded with status: ${agentResponse.status}`);
      }

      const musicResult: AgnoMusicResponse = await agentResponse.json();

      if (!musicResult.success) {
        throw new Error(musicResult.error || 'Music generation failed');
      }

      setVibeState({
        isAnalyzing: false,
        decision,
        error: musicResult.error || null,
      });

      if (musicResult.vibeDescription) {
        console.log('🗣️ Vibe description:', musicResult.vibeDescription);
      }

      if (!musicResult.music) {
        if (musicResult.fallback) {
          await applyFallbackPlayback(musicResult.fallback, decision);
        } else {
          console.warn('No music payload returned from agent response');
          setPlayerError(musicResult.error || 'No music returned from agent');
        }
        return;
      }

      const music = musicResult.music as NonNullable<AgnoMusicResponse['music']>;

      let generatedTrackUrl: string | null = null;

      if (music.audioBase64 && typeof window !== 'undefined') {
        try {
          const binaryString = window.atob(music.audioBase64);
          const byteLength = binaryString.length;
          const bytes = new Uint8Array(byteLength);

          for (let i = 0; i < byteLength; i += 1) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const blob = new Blob([bytes], { type: music.mimeType || 'audio/mpeg' });
          const objectUrl = URL.createObjectURL(blob);

          generatedTrackUrls.current.push(objectUrl);
          if (generatedTrackUrls.current.length > 4) {
            const oldUrl = generatedTrackUrls.current.shift();
            if (oldUrl) {
              URL.revokeObjectURL(oldUrl);
            }
          }

          generatedTrackUrl = objectUrl;
        } catch (prepError) {
          console.warn('Failed to prepare generated music data for playback:', prepError);
        }
      } else if (music.dataUrl) {
        generatedTrackUrl = music.dataUrl;
      }

      if (generatedTrackUrl) {
        const trackName = music.filename
          ? music.filename.replace(/[-_]/g, ' ')
          : (music.style ? `${music.style} vibe track` : 'Custom vibe track');

        const generatedTrack: GeneratedTrack = {
          id: `${music.filename || 'ai-track'}-${analysisTimestamp}`,
          name: trackName,
          url: generatedTrackUrl,
          bpm: decision.suggestedBPM,
          genre: music.style,
          style: music.style,
          description: music.description,
          duration: music.duration,
          createdAt: music.generatedAt || analysisTimestamp,
          source: 'elevenlabs',
        };

        setLatestGeneratedTrack(generatedTrack);

        console.log('🎧 Loading AI-generated track into player', {
          name: generatedTrack.name,
          mime: music.mimeType,
          size: music.sizeBytes,
          source: generatedTrackUrl.startsWith('blob:') ? 'blob' : 'data-url',
        });

        try {
          const loaded = await localPlayer.current.loadPlaylist([generatedTrack]);
          if (!loaded) {
            console.warn('Generated track queued but local player refused to load');
          }
          setLocalPlaybackState(localPlayer.current.getCurrentState());
        } catch (playError) {
          console.warn('Failed to stage generated track for playback:', playError);
        }

        lastStyleRef.current = generatedTrack.style || decision.vibeLabel;
        const lockExtension = Math.max(MIN_STYLE_LOCK_MS, (music.duration ?? 60) * 1000);
        styleLockRef.current = Date.now() + lockExtension;
      } else {
        console.warn('No playable audio data returned from ElevenLabs music response');
        setPlayerError('Music generated but no playable audio was returned');
      }

    } catch (error) {
      console.error('❌ Vibe check failed:', error);
      setVibeState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: error instanceof Error ? error.message : 'Failed to analyze vibe',
      }));
      if (error instanceof Error) {
        setPlayerError(error.message);
      } else {
        setPlayerError('Unknown error occurred during vibe check');
      }
    } finally {
      setIsProcessing(false);
    }
  }, [
    ensureStats,
    isProcessing,
    generatedTrackUrls,
    weather,
    vibeState.decision?.vibeLabel,
    applyFallbackPlayback,
    lastStyleRef,
    styleLockRef,
  ]);

  // Toggle vibe check
  const toggleVibeCheck = useCallback(async () => {
    if (sensorActive) {
      console.log('🛑 Stopping vibe check');
      stopCapture();
      setIsActive(false);
      setStats(null);
      captureStartedAtRef.current = null;
      captureMetricsHistoryRef.current = [];
      lastVibeCheckRef.current = 0;
      styleLockRef.current = 0;
      lastStyleRef.current = null;
      try {
        await adaptivePlayer.current.pause();
      } catch (pauseError) {
        console.warn('Failed to pause adaptive player:', pauseError);
      }
      generatedTrackUrls.current.forEach((url) => URL.revokeObjectURL(url));
      generatedTrackUrls.current = [];
      setLatestGeneratedTrack(null);
      setPlayerError(null);
    } else {
      console.log('▶️ Starting vibe check');
      setPlayerError(null);
      await startCapture();
      setIsActive(true);
      captureStartedAtRef.current = Date.now();
      captureMetricsHistoryRef.current = [];
      try {
        await adaptivePlayer.current.loadLocalPlaylist(DEFAULT_PLAYLIST);
      } catch (playlistError) {
        console.warn('Failed to load default playlist:', playlistError);
      }
      setLocalPlaybackState(localPlayer.current.getCurrentState());
      void performVibeCheckCycle({ force: true });
    }
  }, [sensorActive, startCapture, stopCapture, performVibeCheckCycle]);

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
      
      // The API returns { success: true, eventData: {...} }
      if (data.success && data.eventData) {
        setEventVibeData(data.eventData);
      } else {
        throw new Error('Invalid response format from API');
      }
    } catch (error) {
      console.error('❌ Event extraction failed:', error);
      setUrlVibeError(error instanceof Error ? error.message : 'Failed to extract event vibe');
    } finally {
      setIsExtractingEvent(false);
    }
  }, [eventUrl]);

  // Apply event vibe
  const applyEventVibe = useCallback(() => {
    if (!eventVibeData || !eventVibeData.vibeLabel) {
      console.warn('Cannot apply event vibe: missing vibe data');
      return;
    }
    
    console.log('🌐 Applying event vibe:', eventVibeData);
    setVibeState({
      isAnalyzing: false,
      decision: {
        vibeLabel: eventVibeData.vibeLabel,
        suggestedBPM: eventVibeData.suggestedBPM || 120,
        suggestedVolume: eventVibeData.suggestedVolume || 0.7,
        spokenTip: `Based on event analysis: ${eventVibeData.vibeDescription || eventVibeData.eventDescription || 'Event-based vibe detected'}`,
        action: 'keep'
      },
      error: null
    });
  }, [eventVibeData]);

  const handlePlayGeneratedTrack = useCallback(async () => {
    if (!latestGeneratedTrack) return;

    try {
      const played = await adaptivePlayer.current.playGeneratedTrack(latestGeneratedTrack);
      setLocalPlaybackState(localPlayer.current.getCurrentState());
      if (!played) {
        setPlayerError('Track loaded but playback did not start automatically. Use Play to retry.');
      } else {
        setPlayerError(null);
      }
    } catch (error) {
      console.warn('Manual playback failed:', error);
      setPlayerError('Failed to play generated track. Try using the Play button.');
    }
  }, [latestGeneratedTrack]);

  const handlePausePlayback = useCallback(async () => {
    try {
      await adaptivePlayer.current.pause();
      setLocalPlaybackState(localPlayer.current.getCurrentState());
    } catch (error) {
      console.warn('Manual pause failed:', error);
    }
  }, []);

  const handleResetPlayback = useCallback(async () => {
    try {
      await adaptivePlayer.current.pause();
      await adaptivePlayer.current.loadLocalPlaylist(DEFAULT_PLAYLIST);
      setLatestGeneratedTrack(null);
      setPlayerError(null);
      setLocalPlaybackState(localPlayer.current.getCurrentState());
      styleLockRef.current = 0;
      lastStyleRef.current = null;
    } catch (error) {
      console.warn('Failed to reset local playback:', error);
      setPlayerError('Failed to reset local playback');
    }
  }, []);

  const isGeneratedTrackPlaying = Boolean(
    latestGeneratedTrack &&
    audioPlaying &&
    localPlaybackState.currentTrack?.id === latestGeneratedTrack.id
  );

  useEffect(() => {
    return () => {
      generatedTrackUrls.current.forEach((url) => URL.revokeObjectURL(url));
      generatedTrackUrls.current = [];
      try {
        adaptivePlayer.current.pause();
      } catch (error) {
        console.warn('Failed to pause adaptive player during cleanup:', error);
      }
      try {
        adaptivePlayer.current.disconnect();
      } catch (disconnectError) {
        console.warn('Failed to disconnect adaptive player:', disconnectError);
      }
    };
  }, []);

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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Columns: Video (spans 2 columns) */}
          <div className="lg:col-span-2">
            <div className="stats-card">
                <h2 className="text-lg font-semibold mb-4 text-gray-900">
                Live Video
              </h2>
              
                <div className="relative mb-4 flex justify-center">
                <video
                    ref={hookVideoRef}
                    className="video-preview w-full bg-gray-900 rounded-lg"
                  autoPlay
                  muted
                  playsInline
                    style={{ 
                      objectFit: 'contain',
                      aspectRatio: '16/9',
                      height: 'auto',
                      maxHeight: '300px'
                    }}
                />
                <canvas
                    ref={hookCanvasRef}
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

          {/* Middle Column: Weather & URL */}
          <div className="lg:col-span-1 space-y-6">
            {/* Weather Box */}
            <div className="stats-card">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 text-center">
                🌤️ Weather
              </h3>
              {weather ? (
                <div className="text-center space-y-2">
                  <div className="text-2xl font-bold text-gray-900">{Math.round(weather.temperature)}°C</div>
                  <div className="text-sm text-gray-600">{weather.location}</div>
                  <div className="text-xs text-gray-600 capitalize">{weather.description}</div>
                </div>
              ) : (
                <div className="text-center text-sm text-gray-600">Loading weather...</div>
              )}
            </div>

            {/* URL Box */}
            <div className="stats-card">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                🌐 Event URL
                <span className="text-xs px-2 py-1 bg-purple-100 text-purple-600 rounded-full">
                  Gemini
                </span>
              </h2>
              
              <div className="space-y-3">
                <input
                  type="url"
                  value={eventUrl}
                  onChange={(e) => setEventUrl(e.target.value)}
                  placeholder="Paste event URL here..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
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

                {eventVibeData && eventVibeData.vibeLabel && (
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
                      {eventVibeData.vibeDescription || eventVibeData.eventDescription || 'Event analysis completed'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Live Metrics */}
          <div className="lg:col-span-1">
            <div className="stats-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Live Metrics
                </h2>
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
              </div>

              {stats ? (
                <div className="space-y-3">
                  <VibeMeter label="Brightness" value={stats.avgBrightness} type="brightness" />
                  <VibeMeter label="Motion" value={stats.motionLevel} type="motion" />
                  <VibeMeter label="Faces" value={stats.faces ?? 0} max={10} type="faces" />
                  <VibeMeter
                    label="Smiles"
                    value={stats.smiles ?? 0}
                    max={Math.max(1, stats.faces ?? 0)}
                    type="smiles"
                  />
                  
                  {stats.audioVolume !== undefined && (
                    <VibeMeter label="Audio Level" value={stats.audioVolume} type="motion" />
                  )}
                  
                  <div className="text-xs text-gray-600 pt-2 border-t border-gray-200">
                    Updated: {new Date().toLocaleTimeString()}
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-700 py-8">
                  <div className="text-gray-700">
                    Start vibe check to see metrics
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Row: Current Vibe */}
        <div className="mt-6 space-y-6">
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

          <GeneratedTrackWidget
            track={latestGeneratedTrack}
            playbackState={localPlaybackState}
            isPlaying={isGeneratedTrackPlaying}
            onPlay={handlePlayGeneratedTrack}
            onPause={handlePausePlayback}
            onReset={handleResetPlayback}
            error={playerError}
          />
        </div>
      </div>
    </div>
  );
}

export default function VibeCheckPage() {
  return (
    <ClientOnly>
      <VibeCheckPageInner />
    </ClientOnly>
  );
}
