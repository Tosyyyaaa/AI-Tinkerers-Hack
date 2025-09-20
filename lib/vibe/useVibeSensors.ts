'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RoomStats } from '@/lib/types/vibe';
import { AudioAnalyser, AudioMetrics, getAudioAnalyser, resetAudioAnalyser } from '@/lib/audio/audioAnalyser';

// Style detection constants
const MOTION_ZONES = 5; // left, center, right, top, bottom
const COLOR_SAMPLE_SIZE = 100; // number of pixels to sample for color analysis

interface VibeConfig {
  updateInterval: number; // ms between analysis updates
  motionSmoothingFactor: number; // EMA smoothing for motion
  brightnessThreshold: number; // min change to trigger update
}

const DEFAULT_CONFIG: VibeConfig = {
  updateInterval: 1000, // 1 second
  motionSmoothingFactor: 0.3, // 30% new, 70% old
  brightnessThreshold: 0.02, // 2% change
};

export function useVibeSensors(config: Partial<VibeConfig> = {}) {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [isActive, setIsActive] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<RoomStats | null>(null);
  
  // Refs for video and analysis
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Audio analysis
  const audioAnalyserRef = useRef<AudioAnalyser | null>(null);
  const currentAudioMetrics = useRef<AudioMetrics | null>(null);
  
  // Motion detection state
  const previousFrameRef = useRef<ImageData | null>(null);
  const smoothedMotionRef = useRef(0);
  const motionZonesRef = useRef<number[]>(new Array(MOTION_ZONES).fill(0));

  // Color analysis state
  const dominantColorsRef = useRef<string[]>([]);
  const colorVarianceRef = useRef(0);

  // Style and lighting detection
  const styleIndicatorRef = useRef<"formal" | "casual" | "party" | "professional" | "mixed">("mixed");
  const lightingPatternRef = useRef<"steady" | "dynamic" | "strobe" | "dim">("steady");
  const crowdDensityRef = useRef(0);
  
  // Rolling averages for smoothing
  const brightnessHistoryRef = useRef<number[]>([]);
  const colorTempHistoryRef = useRef<number[]>([]);
  
  // RGB to HSL conversion for color analysis
  const rgbToHsl = useCallback((r: number, g: number, b: number): [number, number, number] => {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [h * 360, s * 100, l * 100];
  }, []);

  // Convert RGB to hex string
  const rgbToHex = useCallback((r: number, g: number, b: number): string => {
    return '#' + [r, g, b].map(x => {
      const hex = Math.round(x).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }, []);

  // Initialise audio analysis
  const initAudioAnalysis = useCallback(async () => {
    try {
      audioAnalyserRef.current = getAudioAnalyser(
        {
          fftSize: 2048,
          smoothingTimeConstant: 0.8,
          updateInterval: 100,
        },
        {
          onAudioData: (metrics: AudioMetrics) => {
            currentAudioMetrics.current = metrics;
          },
          onError: (error: string) => {
            console.warn('Audio analysis error:', error);
            setError(prev => prev || `Audio analysis: ${error}`);
          },
          onPermissionGranted: () => {
            setHasMicPermission(true);
          },
          onPermissionDenied: () => {
            setHasMicPermission(false);
            console.warn('Microphone permission denied - continuing with visual-only analysis');
          },
        }
      );

      const success = await audioAnalyserRef.current.initialise();
      if (success) {
        audioAnalyserRef.current.start();
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Failed to initialise audio analysis:', err);
      return false;
    }
  }, []);

  // Calculate brightness from image data
  const calculateBrightness = useCallback((imageData: ImageData): number => {
    const { data, width, height } = imageData;
    let totalLuma = 0;
    
    // Sample every 4th pixel for performance
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Convert RGB to luma (Y')
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      totalLuma += luma;
    }
    
    const avgLuma = totalLuma / (width * height / 4);
    return Math.min(1, avgLuma / 255);
  }, []);

  // Estimate colour temperature
  const calculateColorTemp = useCallback((imageData: ImageData): number => {
    const { data } = imageData;
    let totalR = 0, totalG = 0, totalB = 0;
    let sampleCount = 0;
    
    // Sample every 16th pixel
    for (let i = 0; i < data.length; i += 64) {
      totalR += data[i];
      totalG += data[i + 1];
      totalB += data[i + 2];
      sampleCount++;
    }
    
    const avgR = totalR / sampleCount;
    const avgB = totalB / sampleCount;
    
    // Rough colour temperature estimation based on R/B ratio
    const ratio = avgR / (avgB + 1); // +1 to avoid division by zero
    
    // Map ratio to Kelvin (very rough approximation)
    if (ratio > 1.2) return 2500; // Warm (incandescent)
    if (ratio > 1.0) return 3000; // Warm white
    if (ratio > 0.9) return 4000; // Neutral
    if (ratio > 0.8) return 5000; // Cool white
    return 6500; // Daylight
  }, []);

  // Calculate zone-based motion detection
  const calculateZoneMotion = useCallback((currentFrame: ImageData): { totalMotion: number; zoneMotions: number[] } => {
    if (!previousFrameRef.current) {
      previousFrameRef.current = currentFrame;
      return { totalMotion: 0, zoneMotions: new Array(MOTION_ZONES).fill(0) };
    }

    const current = currentFrame.data;
    const previous = previousFrameRef.current.data;
    const { width, height } = currentFrame;

    // Define zones: left, center, right, top, bottom
    const zones = [
      { name: 'left', x: 0, y: 0, w: width / 3, h: height },
      { name: 'center', x: width / 3, y: 0, w: width / 3, h: height },
      { name: 'right', x: (2 * width) / 3, y: 0, w: width / 3, h: height },
      { name: 'top', x: 0, y: 0, w: width, h: height / 2 },
      { name: 'bottom', x: 0, y: height / 2, w: width, h: height / 2 }
    ];

    const zoneMotions: number[] = [];
    let totalDiff = 0;
    let totalSamples = 0;

    zones.forEach(zone => {
      let zoneDiff = 0;
      let zoneSamples = 0;

      // Sample pixels in this zone
      for (let y = Math.floor(zone.y); y < Math.floor(zone.y + zone.h); y += 4) {
        for (let x = Math.floor(zone.x); x < Math.floor(zone.x + zone.w); x += 4) {
          const pixelIndex = (y * width + x) * 4;
          if (pixelIndex < current.length - 3) {
            const rDiff = Math.abs(current[pixelIndex] - previous[pixelIndex]);
            const gDiff = Math.abs(current[pixelIndex + 1] - previous[pixelIndex + 1]);
            const bDiff = Math.abs(current[pixelIndex + 2] - previous[pixelIndex + 2]);

            const pixelDiff = (rDiff + gDiff + bDiff) / 3;
            zoneDiff += pixelDiff;
            zoneSamples++;

            totalDiff += pixelDiff;
            totalSamples++;
          }
        }
      }

      const avgZoneDiff = zoneSamples > 0 ? zoneDiff / zoneSamples : 0;
      const normalizedZoneDiff = Math.min(1, avgZoneDiff / 50);
      zoneMotions.push(normalizedZoneDiff);
    });

    const avgTotalDiff = totalSamples > 0 ? totalDiff / totalSamples : 0;
    const normalizedTotalDiff = Math.min(1, avgTotalDiff / 50);

    // Apply EMA smoothing
    smoothedMotionRef.current =
      fullConfig.motionSmoothingFactor * normalizedTotalDiff +
      (1 - fullConfig.motionSmoothingFactor) * smoothedMotionRef.current;

    // Smooth zone motions
    zoneMotions.forEach((zoneMotion, index) => {
      motionZonesRef.current[index] =
        fullConfig.motionSmoothingFactor * zoneMotion +
        (1 - fullConfig.motionSmoothingFactor) * motionZonesRef.current[index];
    });

    // Update previous frame with decay
    const decayFactor = 0.95;
    for (let i = 0; i < previous.length; i += 4) {
      previous[i] = previous[i] * decayFactor + current[i] * (1 - decayFactor);
      previous[i + 1] = previous[i + 1] * decayFactor + current[i + 1] * (1 - decayFactor);
      previous[i + 2] = previous[i + 2] * decayFactor + current[i + 2] * (1 - decayFactor);
    }

    return { totalMotion: smoothedMotionRef.current, zoneMotions: [...motionZonesRef.current] };
  }, [fullConfig.motionSmoothingFactor]);

  // Analyze dominant colors and color variance
  const analyzeColors = useCallback((imageData: ImageData): { dominantColors: string[]; colorVariance: number } => {
    const { data, width, height } = imageData;
    const colorMap: { [key: string]: number } = {};
    const hslValues: number[][] = [];

    // Sample pixels for color analysis
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Skip very dark or very bright pixels (likely shadows/highlights)
      const brightness = (r + g + b) / 3;
      if (brightness < 30 || brightness > 225) continue;

      const hex = rgbToHex(r, g, b);
      colorMap[hex] = (colorMap[hex] || 0) + 1;

      const [h, s, l] = rgbToHsl(r, g, b);
      hslValues.push([h, s, l]);
    }

    // Get top 5 dominant colors
    const sortedColors = Object.entries(colorMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([color]) => color);

    // Calculate color variance using HSL values
    let hueVariance = 0;
    let saturationVariance = 0;

    if (hslValues.length > 1) {
      const avgHue = hslValues.reduce((sum, [h]) => sum + h, 0) / hslValues.length;
      const avgSat = hslValues.reduce((sum, [, s]) => sum + s, 0) / hslValues.length;

      hueVariance = Math.sqrt(hslValues.reduce((sum, [h]) => sum + Math.pow(h - avgHue, 2), 0) / hslValues.length) / 180;
      saturationVariance = Math.sqrt(hslValues.reduce((sum, [, s]) => sum + Math.pow(s - avgSat, 2), 0) / hslValues.length) / 100;
    }

    const colorVariance = Math.min(1, (hueVariance + saturationVariance) / 2);

    return { dominantColors: sortedColors, colorVariance };
  }, [rgbToHex, rgbToHsl]);

  // Detect style indicator based on colors and lighting
  const detectStyle = useCallback((colors: string[], colorVariance: number, brightness: number): "formal" | "casual" | "party" | "professional" | "mixed" => {
    // Analyze color characteristics
    const hasVibrantColors = colors.some(color => {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      const [, s] = rgbToHsl(r, g, b);
      return s > 60; // High saturation = vibrant
    });

    const hasNeutralColors = colors.every(color => {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      const [, s] = rgbToHsl(r, g, b);
      return s < 30; // Low saturation = neutral
    });

    // Style classification logic
    if (hasVibrantColors && colorVariance > 0.6) {
      return "party"; // Many vibrant, varied colors
    } else if (hasNeutralColors && colorVariance < 0.3) {
      return "formal"; // Few neutral colors
    } else if (hasNeutralColors && brightness < 0.4) {
      return "professional"; // Dark neutral colors
    } else if (colorVariance > 0.4 && brightness > 0.6) {
      return "casual"; // Varied colors, bright lighting
    } else {
      return "mixed"; // Default fallback
    }
  }, [rgbToHsl]);

  // Detect lighting patterns
  const detectLighting = useCallback((brightness: number, motion: number, zoneMotions: number[]): "steady" | "dynamic" | "strobe" | "dim" => {
    const motionVariance = Math.sqrt(zoneMotions.reduce((sum, m) => sum + Math.pow(m - motion, 2), 0) / zoneMotions.length);

    if (brightness < 0.2) {
      return "dim";
    } else if (motionVariance > 0.3 && motion > 0.5) {
      return "strobe"; // High motion variance suggests flickering lights
    } else if (motion > 0.4 || motionVariance > 0.2) {
      return "dynamic"; // Moving lights or changing conditions
    } else {
      return "steady"; // Consistent lighting
    }
  }, []);

  // Estimate crowd density based on motion patterns
  const estimateCrowdDensity = useCallback((motion: number, zoneMotions: number[], audioEnergy: number): number => {
    // Multiple zones with motion suggests multiple people
    const activeZones = zoneMotions.filter(m => m > 0.1).length;
    const avgZoneMotion = zoneMotions.reduce((sum, m) => sum + m, 0) / zoneMotions.length;

    // Higher audio energy often correlates with more people
    const audioFactor = Math.min(1, audioEnergy * 1.5);

    // Combine factors
    const zoneFactor = activeZones / MOTION_ZONES; // 0-1 based on active zones
    const motionFactor = Math.min(1, avgZoneMotion * 2); // Motion intensity

    return Math.min(1, (zoneFactor + motionFactor + audioFactor) / 3);
  }, []);

  // Analyse current video frame
  const analyseFrame = useCallback(async (): Promise<RoomStats | null> => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Calculate basic stats
    const brightness = calculateBrightness(imageData);
    const colorTemp = calculateColorTemp(imageData);
    const { totalMotion, zoneMotions } = calculateZoneMotion(imageData);

    // Smooth brightness and color temp with rolling averages
    brightnessHistoryRef.current.push(brightness);
    colorTempHistoryRef.current.push(colorTemp);

    // Keep only last 5 readings
    if (brightnessHistoryRef.current.length > 5) {
      brightnessHistoryRef.current.shift();
    }
    if (colorTempHistoryRef.current.length > 5) {
      colorTempHistoryRef.current.shift();
    }

    const avgBrightness = brightnessHistoryRef.current.reduce((a, b) => a + b, 0) / brightnessHistoryRef.current.length;
    const avgColorTemp = colorTempHistoryRef.current.reduce((a, b) => a + b, 0) / colorTempHistoryRef.current.length;

    // Get current audio metrics
    const audioMetrics = currentAudioMetrics.current;
    const audioVolume = audioMetrics?.volume || 0;
    const audioEnergy = audioMetrics?.energy || 0;
    const noiseLevel = audioMetrics?.noiseLevel || 0;
    const speechProbability = audioMetrics?.speechProbability || 0;
    const pitch = audioMetrics?.pitch || 0;
    const spectralCentroid = audioMetrics?.spectralCentroid || 0;

    // Perform advanced analysis
    const { dominantColors, colorVariance } = analyzeColors(imageData);
    const styleIndicator = detectStyle(dominantColors, colorVariance, avgBrightness);
    const lightingPattern = detectLighting(avgBrightness, totalMotion, zoneMotions);
    const crowdDensity = estimateCrowdDensity(totalMotion, zoneMotions, audioEnergy);

    // Update refs for style persistence
    dominantColorsRef.current = dominantColors;
    colorVarianceRef.current = colorVariance;
    styleIndicatorRef.current = styleIndicator;
    lightingPatternRef.current = lightingPattern;
    crowdDensityRef.current = crowdDensity;

    return {
      // Visual metrics
      avgBrightness,
      colorTempK: avgColorTemp,
      motionLevel: totalMotion,
      // New style detection metrics
      motionZones: zoneMotions,
      crowdDensity,
      styleIndicator,
      dominantColors,
      colorVariance,
      lightingPattern,
      // Audio metrics
      audioVolume,
      audioEnergy,
      noiseLevel,
      speechProbability,
      pitch,
      spectralCentroid,
    };
  }, [calculateBrightness, calculateColorTemp, calculateZoneMotion, analyzeColors, detectStyle, detectLighting, estimateCrowdDensity]);

  // Start webcam capture
  const startCapture = useCallback(async () => {
    try {
      setError(null);
      
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      
      streamRef.current = stream;
      setHasPermission(true);
      
      // Setup video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => resolve();
          }
        });
      }
      
      // Initialize style detection state
      dominantColorsRef.current = [];
      colorVarianceRef.current = 0;
      styleIndicatorRef.current = "mixed";
      lightingPatternRef.current = "steady";
      crowdDensityRef.current = 0;
      
      // Initialise audio analysis (non-blocking)
      try {
        await initAudioAnalysis();
      } catch (audioError) {
        console.warn('Audio analysis failed to start, continuing with visual-only:', audioError);
      }
      
      // Start analysis loop
      intervalRef.current = setInterval(async () => {
        const newStats = await analyseFrame();
        if (newStats) {
          setStats(newStats);
        }
      }, fullConfig.updateInterval);
      
      setIsActive(true);
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access camera';
      setError(message);
      setHasPermission(false);
    }
  }, [analyseFrame, fullConfig.updateInterval, initAudioAnalysis]);

  // Stop webcam capture
  const stopCapture = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    // Reset style detection state
    dominantColorsRef.current = [];
    colorVarianceRef.current = 0;
    styleIndicatorRef.current = "mixed";
    lightingPatternRef.current = "steady";
    crowdDensityRef.current = 0;
    motionZonesRef.current = new Array(MOTION_ZONES).fill(0);
    
    // Stop audio analysis
    if (audioAnalyserRef.current) {
      audioAnalyserRef.current.stop();
      audioAnalyserRef.current.destroy();
      audioAnalyserRef.current = null;
    }
    resetAudioAnalyser();
    
    // Reset state
    previousFrameRef.current = null;
    smoothedMotionRef.current = 0;
    brightnessHistoryRef.current = [];
    colorTempHistoryRef.current = [];
    currentAudioMetrics.current = null;
    
    setIsActive(false);
    setHasMicPermission(false);
    setStats(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, [stopCapture]);

  return {
    isActive,
    hasPermission,
    hasMicPermission,
    error,
    stats,
    videoRef,
    canvasRef,
    startCapture,
    stopCapture,
    // Audio analysis utilities
    getAudioAnalyser: () => audioAnalyserRef.current,
    getCurrentAudioMetrics: () => currentAudioMetrics.current,
  };
}
