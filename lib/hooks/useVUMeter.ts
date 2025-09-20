import { useState, useEffect, useRef, useCallback } from 'react';

interface VUMeterData {
  leftRMS: number;
  rightRMS: number;
  leftPeak: number;
  rightPeak: number;
}

/**
 * Custom hook for VU meter visualization with RMS and peak detection
 */
export const useVUMeter = (analyser: AnalyserNode | null): VUMeterData => {
  const [meterData, setMeterData] = useState<VUMeterData>({
    leftRMS: 0,
    rightRMS: 0,
    leftPeak: 0,
    rightPeak: 0
  });

  const animationFrameRef = useRef<number | null>(null);
  const peakHoldRef = useRef({ left: 0, right: 0, leftTime: 0, rightTime: 0 });

  const updateMeters = useCallback(() => {
    if (!analyser) {
      setMeterData({ leftRMS: 0, rightRMS: 0, leftPeak: 0, rightPeak: 0 });
      return;
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    // Calculate RMS (Root Mean Square) for perceived loudness
    let sumSquares = 0;
    for (let i = 0; i < bufferLength; i++) {
      const normalized = dataArray[i] / 255.0;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / bufferLength);

    // For stereo simulation, use slight variations
    const leftRMS = rms;
    const rightRMS = rms * (0.9 + Math.random() * 0.2); // Add some variation

    // Peak detection with hold
    const currentTime = Date.now();
    const peakHoldTime = 1500; // Hold peaks for 1.5 seconds
    const peakDecayRate = 0.95; // Decay rate when not holding

    // Update left peak
    if (leftRMS > peakHoldRef.current.left) {
      peakHoldRef.current.left = leftRMS;
      peakHoldRef.current.leftTime = currentTime;
    } else if (currentTime - peakHoldRef.current.leftTime > peakHoldTime) {
      peakHoldRef.current.left *= peakDecayRate;
    }

    // Update right peak
    if (rightRMS > peakHoldRef.current.right) {
      peakHoldRef.current.right = rightRMS;
      peakHoldRef.current.rightTime = currentTime;
    } else if (currentTime - peakHoldRef.current.rightTime > peakHoldTime) {
      peakHoldRef.current.right *= peakDecayRate;
    }

    setMeterData({
      leftRMS: leftRMS * 100, // Convert to percentage
      rightRMS: rightRMS * 100,
      leftPeak: peakHoldRef.current.left * 100,
      rightPeak: peakHoldRef.current.right * 100
    });
  }, [analyser]);

  useEffect(() => {
    if (!analyser) return;

    const animate = () => {
      updateMeters();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [analyser, updateMeters]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, []);

  return meterData;
};
