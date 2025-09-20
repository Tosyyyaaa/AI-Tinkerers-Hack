import { useRef, useCallback, useEffect } from 'react';

interface AudioEngine {
  boost: (dB: number) => void;
  playClick: () => void;
  reset: () => void;
  getAnalyser: () => AnalyserNode | null;
}

/**
 * Custom hook for Web Audio API engine with gain boost and limiter
 */
export const useAudioEngine = (): AudioEngine => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const clickBufferRef = useRef<AudioBuffer | null>(null);

  // Initialize audio context and nodes
  const initAudio = useCallback(async () => {
    if (audioContextRef.current) return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Create gain node for volume control
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1.0; // Unity gain
      gainNodeRef.current = gainNode;

      // Create compressor for soft limiting
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -6; // dB
      compressor.knee.value = 30; // dB
      compressor.ratio.value = 12; // 12:1 ratio
      compressor.attack.value = 0.003; // 3ms
      compressor.release.value = 0.25; // 250ms
      compressorRef.current = compressor;

      // Create analyser for VU meters
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      // Connect audio chain: gain -> compressor -> analyser -> destination
      gainNode.connect(compressor);
      compressor.connect(analyser);
      analyser.connect(audioContext.destination);

      // Create click sound buffer
      const clickBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate);
      const channelData = clickBuffer.getChannelData(0);
      
      // Generate click sound (short sine wave with envelope)
      for (let i = 0; i < channelData.length; i++) {
        const t = i / audioContext.sampleRate;
        const envelope = Math.exp(-t * 50); // Exponential decay
        channelData[i] = Math.sin(2 * Math.PI * 1200 * t) * envelope * 0.3;
      }
      
      clickBufferRef.current = clickBuffer;

    } catch (error) {
      console.warn('Failed to initialize audio context:', error);
    }
  }, []);

  // Boost gain by specified dB amount
  const boost = useCallback((dB: number) => {
    if (!gainNodeRef.current || !audioContextRef.current) {
      initAudio();
      return;
    }

    // Clamp dB boost to safe range
    const clampedDB = Math.max(-12, Math.min(6, dB));
    const linearGain = Math.pow(10, clampedDB / 20);

    // Smooth ramp to prevent clicks
    const currentTime = audioContextRef.current.currentTime;
    gainNodeRef.current.gain.cancelScheduledValues(currentTime);
    gainNodeRef.current.gain.setTargetAtTime(linearGain, currentTime, 0.05); // 50ms ramp
  }, [initAudio]);

  // Play UI click sound
  const playClick = useCallback(() => {
    if (!audioContextRef.current || !clickBufferRef.current) {
      initAudio();
      return;
    }

    try {
      const source = audioContextRef.current.createBufferSource();
      const clickGain = audioContextRef.current.createGain();
      
      source.buffer = clickBufferRef.current;
      clickGain.gain.value = 0.5;
      
      source.connect(clickGain);
      clickGain.connect(audioContextRef.current.destination);
      
      source.start();
      source.stop(audioContextRef.current.currentTime + 0.1);
    } catch (error) {
      console.warn('Failed to play click sound:', error);
    }
  }, [initAudio]);

  // Reset gain to unity
  const reset = useCallback(() => {
    if (!gainNodeRef.current || !audioContextRef.current) return;

    const currentTime = audioContextRef.current.currentTime;
    gainNodeRef.current.gain.cancelScheduledValues(currentTime);
    gainNodeRef.current.gain.setTargetAtTime(1.0, currentTime, 0.1); // 100ms ramp to unity
  }, []);

  // Get analyser for VU meter
  const getAnalyser = useCallback(() => {
    return analyserRef.current;
  }, []);

  // Initialize on mount
  useEffect(() => {
    const handleUserInteraction = () => {
      initAudio();
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };

    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, [initAudio]);

  return {
    boost,
    playClick,
    reset,
    getAnalyser
  };
};
