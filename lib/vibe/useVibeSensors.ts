'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RoomStats } from '@/lib/types/vibe';
import { AudioAnalyser, AudioMetrics, getAudioAnalyser, resetAudioAnalyser } from '@/lib/audio/audioAnalyser';

// MediaPipe Face Detection (will be loaded dynamically)
let FaceDetection: any = null;
let Camera: any = null;

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
  const faceDetectionRef = useRef<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Audio analysis
  const audioAnalyserRef = useRef<AudioAnalyser | null>(null);
  const currentAudioMetrics = useRef<AudioMetrics | null>(null);
  
  // Motion detection state
  const previousFrameRef = useRef<ImageData | null>(null);
  const smoothedMotionRef = useRef(0);
  
  // Rolling averages for smoothing
  const brightnessHistoryRef = useRef<number[]>([]);
  const colorTempHistoryRef = useRef<number[]>([]);
  
  // Load MediaPipe Face Detection dynamically
  const loadFaceDetection = useCallback(async () => {
    try {
      if (typeof window === 'undefined') return false;
      
      // Load MediaPipe modules
      const { FaceDetection: FD } = await import('@mediapipe/face_detection');
      const { Camera: Cam } = await import('@mediapipe/camera_utils');
      
      FaceDetection = FD;
      Camera = Cam;
      return true;
    } catch (err) {
      console.warn('MediaPipe not available, falling back to basic analysis:', err);
      return false;
    }
  }, []);

  // Initialise face detection
  const initFaceDetection = useCallback(async () => {
    if (!FaceDetection) return null;
    
    try {
      const faceDetection = new FaceDetection({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
        }
      });
      
      faceDetection.setOptions({
        model: 'short',
        minDetectionConfidence: 0.5,
      });
      
      return faceDetection;
    } catch (err) {
      console.warn('Failed to initialise face detection:', err);
      return null;
    }
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

  // Calculate motion level using frame difference
  const calculateMotion = useCallback((currentFrame: ImageData): number => {
    if (!previousFrameRef.current) {
      previousFrameRef.current = currentFrame;
      return 0;
    }
    
    const current = currentFrame.data;
    const previous = previousFrameRef.current.data;
    let totalDiff = 0;
    let sampleCount = 0;
    
    // Sample every 16th pixel for performance
    for (let i = 0; i < current.length; i += 64) {
      const rDiff = Math.abs(current[i] - previous[i]);
      const gDiff = Math.abs(current[i + 1] - previous[i + 1]);
      const bDiff = Math.abs(current[i + 2] - previous[i + 2]);
      
      const pixelDiff = (rDiff + gDiff + bDiff) / 3;
      totalDiff += pixelDiff;
      sampleCount++;
    }
    
    const avgDiff = totalDiff / sampleCount;
    const normalizedDiff = Math.min(1, avgDiff / 50); // Normalize to 0-1
    
    // Apply EMA smoothing
    smoothedMotionRef.current = 
      fullConfig.motionSmoothingFactor * normalizedDiff + 
      (1 - fullConfig.motionSmoothingFactor) * smoothedMotionRef.current;
    
    // Update previous frame with decay to avoid stuck backgrounds
    const decayFactor = 0.95;
    for (let i = 0; i < previous.length; i += 4) {
      previous[i] = previous[i] * decayFactor + current[i] * (1 - decayFactor);
      previous[i + 1] = previous[i + 1] * decayFactor + current[i + 1] * (1 - decayFactor);
      previous[i + 2] = previous[i + 2] * decayFactor + current[i + 2] * (1 - decayFactor);
    }
    
    return smoothedMotionRef.current;
  }, [fullConfig.motionSmoothingFactor]);

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
    const motion = calculateMotion(imageData);
    
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
    
    // Face detection (basic fallback if MediaPipe fails)
    let faces = 0;
    let smiles = 0;
    
    try {
      if (faceDetectionRef.current) {
        // TODO: Implement MediaPipe face detection
        // For now, use a simple heuristic based on brightness patterns
        // This is a placeholder - real implementation would use MediaPipe
        // Use consistent values to prevent hydration issues
        faces = brightness > 0.3 ? (motion > 0.1 ? 2 : 1) : 0;
        smiles = faces > 0 ? Math.min(faces, brightness > 0.5 ? faces : Math.floor(faces / 2)) : 0;
      }
    } catch (err) {
      console.warn('Face detection failed:', err);
    }
    
    // Get current audio metrics
    const audioMetrics = currentAudioMetrics.current;
    const audioVolume = audioMetrics?.volume || 0;
    const audioEnergy = audioMetrics?.energy || 0;
    const noiseLevel = audioMetrics?.noiseLevel || 0;
    const speechProbability = audioMetrics?.speechProbability || 0;
    const pitch = audioMetrics?.pitch || 0;
    const spectralCentroid = audioMetrics?.spectralCentroid || 0;

    return {
      faces,
      smiles,
      avgBrightness,
      colorTempK: avgColorTemp,
      motionLevel: motion,
      audioVolume,
      audioEnergy,
      noiseLevel,
      speechProbability,
      pitch,
      spectralCentroid,
    };
  }, [calculateBrightness, calculateColorTemp, calculateMotion]);

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
      
      // Load face detection
      const faceDetectionLoaded = await loadFaceDetection();
      if (faceDetectionLoaded) {
        faceDetectionRef.current = await initFaceDetection();
      }
      
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
  }, [analyseFrame, fullConfig.updateInterval, initFaceDetection, loadFaceDetection]);

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
    
    if (faceDetectionRef.current) {
      faceDetectionRef.current.close();
      faceDetectionRef.current = null;
    }
    
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
