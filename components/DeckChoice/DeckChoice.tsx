'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import { useAudioEngine } from '@/lib/hooks/useAudioEngine';
import { useVUMeter } from '@/lib/hooks/useVUMeter';
import { useGrain } from '@/lib/hooks/useGrain';
import './DeckChoice.css';

export interface DeckChoiceProps {
  onSelect: (id: "hot-cue" | "amplify") => void;
  useSpotify?: boolean;
}

/**
 * DJ Deck Choice Component - Mini DJ deck interface for option selection
 */
export const DeckChoice: React.FC<DeckChoiceProps> = ({
  onSelect,
  useSpotify = false
}) => {
  // Refs for DOM elements
  const containerRef = useRef<HTMLDivElement>(null);
  const primaryPadRef = useRef<HTMLDivElement>(null);
  const leftJogRef = useRef<HTMLDivElement>(null);
  const rightJogRef = useRef<HTMLDivElement>(null);
  const volumeFaderRef = useRef<HTMLDivElement>(null);
  const leftVURef = useRef<HTMLDivElement>(null);
  const rightVURef = useRef<HTMLDivElement>(null);
  const leftPeakRef = useRef<HTMLDivElement>(null);
  const rightPeakRef = useRef<HTMLDivElement>(null);

  // State management
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [faderPosition, setFaderPosition] = useState(0.5); // 0-1 range
  const [isAmplifyActive, setIsAmplifyActive] = useState(false);

  // Audio engine and VU meter
  const audioEngine = useAudioEngine();
  const analyser = audioEngine.getAnalyser();
  const vuData = useVUMeter(analyser);

  // Grain texture
  const grainCanvasRef = useGrain(0.12, 0.4, 1);

  // TTS function
  const speakFeedback = useCallback(async (text: string) => {
    try {
      await fetch('/api/deck-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
    } catch (error) {
      console.warn('TTS request failed:', error);
    }
  }, []);

  // Handle Hot Cue selection
  const handleHotCue = useCallback(() => {
    if (selectedOption === 'hot-cue') return;

    setSelectedOption('hot-cue');
    audioEngine.playClick();
    speakFeedback('Hot cue armed');

    // Visual animations
    if (primaryPadRef.current) {
      // Add ripple effect
      const ripple = document.createElement('div');
      ripple.className = 'cue-pad-ripple';
      primaryPadRef.current.appendChild(ripple);

      // Remove ripple after animation
      setTimeout(() => {
        if (primaryPadRef.current?.contains(ripple)) {
          primaryPadRef.current.removeChild(ripple);
        }
      }, 500);

      // Strobe effect on jog rings
      [leftJogRef.current, rightJogRef.current].forEach(jog => {
        if (jog) {
          const ring = jog.querySelector('.jog-wheel-ring') as HTMLElement;
          if (ring) {
            ring.style.animation = 'strobeRing 0.12s ease-out 3';
            setTimeout(() => {
              ring.style.animation = 'jogRotate 8s linear infinite';
            }, 360);
          }
        }
      });
    }

    // Call selection callback
    setTimeout(() => onSelect('hot-cue'), 300);
  }, [selectedOption, audioEngine, speakFeedback, onSelect]);

  // Handle Amplify selection
  const handleAmplify = useCallback(() => {
    if (selectedOption === 'amplify') return;

    setSelectedOption('amplify');
    setIsAmplifyActive(true);
    
    // Apply gain boost
    const boostDB = 3 + (faderPosition * 3); // 3-6 dB range
    audioEngine.boost(boostDB);
    speakFeedback(`Boost engaged +${boostDB.toFixed(1)} dB`);

    // Animate fader up
    if (volumeFaderRef.current) {
      gsap.to(volumeFaderRef.current, {
        bottom: `${Math.max(60, faderPosition * 100)}px`,
        duration: 0.25,
        ease: 'power2.out'
      });
    }

    // Call selection callback
    setTimeout(() => onSelect('amplify'), 300);
  }, [selectedOption, faderPosition, audioEngine, speakFeedback, onSelect]);

  // Handle volume fader interaction
  const handleFaderMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const newPosition = Math.max(0, Math.min(1, 1 - (y / rect.height)));
    
    setFaderPosition(newPosition);
    
    if (volumeFaderRef.current) {
      gsap.to(volumeFaderRef.current, {
        bottom: `${10 + newPosition * 90}px`,
        duration: 0.1,
        ease: 'none'
      });
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case 'q':
          event.preventDefault();
          handleHotCue();
          break;
        case 'w':
          event.preventDefault();
          handleAmplify();
          break;
        case 'escape':
          event.preventDefault();
          audioEngine.reset();
          setIsAmplifyActive(false);
          setSelectedOption(null);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleHotCue, handleAmplify, audioEngine]);

  // Update VU meters
  useEffect(() => {
    if (leftVURef.current) {
      leftVURef.current.style.height = `${Math.min(100, vuData.leftRMS * 2)}%`;
    }
    if (rightVURef.current) {
      rightVURef.current.style.height = `${Math.min(100, vuData.rightRMS * 2)}%`;
    }
    if (leftPeakRef.current) {
      leftPeakRef.current.style.top = `${Math.max(0, 100 - vuData.leftPeak * 2)}%`;
    }
    if (rightPeakRef.current) {
      rightPeakRef.current.style.top = `${Math.max(0, 100 - vuData.rightPeak * 2)}%`;
    }
  }, [vuData]);

  // Set up grain background
  useEffect(() => {
    if (grainCanvasRef.current && containerRef.current) {
      const canvas = grainCanvasRef.current;
      const url = canvas.toDataURL();
      const grainElement = containerRef.current.querySelector('.deck-bg-grain') as HTMLElement;
      if (grainElement) {
        grainElement.style.backgroundImage = `url(${url})`;
      }
    }
  }, [grainCanvasRef]);

  return (
    <div ref={containerRef} className="deck-choice-container">
      {/* Background layers */}
      <div className="deck-bg-gradient" />
      <div className="deck-bg-rim-glow" />
      <div className="deck-bg-edge-glow" />
      <div className="deck-bg-grain" />

      {/* Hidden canvas for grain texture */}
      <canvas
        ref={grainCanvasRef}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {/* Header */}
      <div className="deck-header">
        <h1 className="deck-title">Pick Your Move</h1>
      </div>

      {/* Main deck area */}
      <div className="deck-main">
        <div className="deck-surface">
          {/* Jog wheels and mixer */}
          <div className="jog-wheels-area">
            {/* Left jog wheel */}
            <div ref={leftJogRef} className="jog-wheel" tabIndex={0}>
              <div className="jog-wheel-ring" />
              <div className="jog-wheel-center" />
            </div>

            {/* Center mixer strip */}
            <div className="mixer-strip">
              {/* VU Meters */}
              <div className="vu-meters">
                <div className="vu-meter">
                  <div ref={leftVURef} className="vu-meter-fill" />
                  <div ref={leftPeakRef} className="vu-meter-peak" />
                </div>
                <div className="vu-meter">
                  <div ref={rightVURef} className="vu-meter-fill" />
                  <div ref={rightPeakRef} className="vu-meter-peak" />
                </div>
              </div>

              {/* Volume fader */}
              <div 
                className="volume-fader-container"
                onMouseMove={handleFaderMove}
                onClick={handleFaderMove}
              >
                <div 
                  ref={volumeFaderRef}
                  className="volume-fader"
                  tabIndex={0}
                  role="slider"
                  aria-label="Volume fader"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(faderPosition * 100)}
                />
              </div>
            </div>

            {/* Right jog wheel */}
            <div ref={rightJogRef} className="jog-wheel" tabIndex={0}>
              <div className="jog-wheel-ring" />
              <div className="jog-wheel-center" />
            </div>
          </div>

          {/* Hot Cue Pads */}
          <div className="cue-pads-area">
            <div className="cue-pads-grid">
              {Array.from({ length: 8 }, (_, i) => (
                <div
                  key={i}
                  ref={i === 0 ? primaryPadRef : undefined}
                  className={`cue-pad ${i === 0 ? 'primary' : ''} ${
                    selectedOption === 'hot-cue' && i === 0 ? 'active' : ''
                  }`}
                  onClick={i === 0 ? handleHotCue : undefined}
                  tabIndex={0}
                  role="button"
                  aria-label={i === 0 ? 'Primary hot cue pad A' : `Hot cue pad ${i + 1}`}
                >
                  {i === 0 ? 'A' : i + 1}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="action-buttons">
        <button
          className={`action-button hot-cue ${selectedOption === 'hot-cue' ? 'active' : ''}`}
          onClick={handleHotCue}
        >
          Hot Cue
          <div style={{ fontSize: '0.8em', opacity: 0.7 }}>Press Q</div>
        </button>
        
        <button
          className={`action-button amplify ${selectedOption === 'amplify' ? 'active' : ''}`}
          onClick={handleAmplify}
        >
          Amplify
          <div style={{ fontSize: '0.8em', opacity: 0.7 }}>Press W</div>
        </button>
      </div>

      {/* Help text */}
      <div className="help-text">
        Use Q for Hot Cue • W for Amplify • ESC to reset
      </div>

      {/* ARIA live region for announcements */}
      <div 
        aria-live="polite" 
        aria-atomic="true"
        style={{ 
          position: 'absolute', 
          left: '-10000px', 
          width: '1px', 
          height: '1px', 
          overflow: 'hidden' 
        }}
      >
        {selectedOption === 'hot-cue' && 'Hot cue selected'}
        {selectedOption === 'amplify' && `Amplify engaged +${(3 + faderPosition * 3).toFixed(1)} dB`}
      </div>
    </div>
  );
};
