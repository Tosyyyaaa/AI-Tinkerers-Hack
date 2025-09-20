'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import { useAudioEngine } from '@/lib/hooks/useAudioEngine';
import { useVUMeter } from '@/lib/hooks/useVUMeter';
import { FlickeringGrid } from '@/components/ui/flickering-grid';
import './ModernDeck.css';

export interface ModernDeckProps {
  onSelect: (id: "hot-cue" | "amplify") => void;
  useSpotify?: boolean;
}

/**
 * Modern DJ Deck Component - Sleek, dark theme with glassmorphic design
 */
export const ModernDeck: React.FC<ModernDeckProps> = ({
  onSelect,
  useSpotify = false
}) => {
  // Refs for DOM elements
  const containerRef = useRef<HTMLDivElement>(null);
  const leftJogRef = useRef<HTMLDivElement>(null);
  const rightJogRef = useRef<HTMLDivElement>(null);
  const primaryPadRef = useRef<HTMLDivElement>(null);
  const crossfaderRef = useRef<HTMLDivElement>(null);
  const leftVURef = useRef<HTMLDivElement>(null);
  const rightVURef = useRef<HTMLDivElement>(null);

  // State management
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [crossfaderPosition, setCrossfaderPosition] = useState(0.5);
  const [leftGain, setLeftGain] = useState(0.7);
  const [rightGain, setRightGain] = useState(0.7);
  const [isPlaying, setIsPlaying] = useState(false);

  // Audio engine
  const audioEngine = useAudioEngine();
  const analyser = audioEngine.getAnalyser();
  const vuData = useVUMeter(analyser);

  // Handle Hot Cue selection
  const handleHotCue = useCallback(() => {
    if (selectedOption === 'hot-cue') return;

    setSelectedOption('hot-cue');
    setIsPlaying(true);
    audioEngine.playClick();

    // Visual animations
    if (primaryPadRef.current) {
      gsap.to(primaryPadRef.current, {
        scale: 1.1,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: 'power2.out'
      });
    }

    // Jog wheel spin effect
    [leftJogRef.current, rightJogRef.current].forEach(jog => {
      if (jog) {
        gsap.to(jog, {
          rotation: '+=360',
          duration: 2,
          ease: 'power2.out'
        });
      }
    });

    setTimeout(() => onSelect('hot-cue'), 300);
  }, [selectedOption, audioEngine, onSelect]);

  // Handle Amplify selection
  const handleAmplify = useCallback(() => {
    if (selectedOption === 'amplify') return;

    setSelectedOption('amplify');
    const boostDB = 3 + (leftGain * 3);
    audioEngine.boost(boostDB);

    // Animate gains up
    gsap.to([leftGain, rightGain], {
      duration: 0.5,
      ease: 'power2.out'
    });

    setTimeout(() => onSelect('amplify'), 300);
  }, [selectedOption, leftGain, rightGain, audioEngine, onSelect]);

  // Handle crossfader movement
  const handleCrossfaderMove = useCallback((event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const newPosition = Math.max(0, Math.min(1, x / rect.width));
    
    setCrossfaderPosition(newPosition);
    
    if (crossfaderRef.current) {
      gsap.to(crossfaderRef.current, {
        x: `${newPosition * 100}%`,
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
          setSelectedOption(null);
          setIsPlaying(false);
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
  }, [vuData]);

  return (
    <div ref={containerRef} className="modern-deck-container">
      {/* Flickering Grid Background */}
      <FlickeringGrid
        className="modern-deck-grid"
        squareSize={4}
        gridGap={6}
        color="#6B7280"
        maxOpacity={0.5}
        flickerChance={0.1}
      />

      {/* Main Deck Surface */}
      <div className="modern-deck-surface">
        
        {/* Top Header */}
        <div className="modern-deck-header">
          <div className="deck-brand">
            <div className="brand-logo">MB</div>
            <div className="brand-text">MusicBuddy</div>
          </div>
          <div className="deck-status">
            <div className={`status-indicator ${isPlaying ? 'playing' : 'stopped'}`} />
            <span className="status-text">{isPlaying ? 'PLAYING' : 'READY'}</span>
          </div>
        </div>

        {/* Main Control Area */}
        <div className="modern-deck-main">
          
          {/* Left Deck */}
          <div className="deck-section left-deck">
            {/* Load/Cue Controls */}
            <div className="deck-controls-top">
              <button className="load-button">LOAD</button>
              <div className="tempo-display">
                <span className="tempo-value">120.0</span>
                <span className="tempo-unit">BPM</span>
              </div>
            </div>

            {/* Jog Wheel */}
            <div className="jog-wheel-container">
              <div 
                ref={leftJogRef}
                className="modern-jog-wheel"
                onClick={handleHotCue}
              >
                <div className="jog-wheel-outer-ring" />
                <div className="jog-wheel-inner">
                  <div className="jog-wheel-center">
                    <div className="jog-wheel-logo">♪</div>
                  </div>
                </div>
                <div className="jog-wheel-markings">
                  {Array.from({ length: 60 }, (_, i) => (
                    <div 
                      key={i} 
                      className="jog-marking"
                      style={{ 
                        transform: `rotate(${i * 6}deg) translateY(-140px)`,
                        height: i % 5 === 0 ? '8px' : '4px'
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Hot Cue Pads */}
            <div className="cue-pads-section">
              <div className="cue-pads-row">
                {Array.from({ length: 4 }, (_, i) => (
                  <div
                    key={i}
                    ref={i === 0 ? primaryPadRef : undefined}
                    className={`modern-cue-pad ${i === 0 ? 'primary' : ''} ${
                      selectedOption === 'hot-cue' && i === 0 ? 'active' : ''
                    }`}
                    onClick={i === 0 ? handleHotCue : undefined}
                  >
                    <span className="pad-number">{i + 1}</span>
                    <span className="pad-label">{i === 0 ? 'HOT CUE' : `CUE ${i + 1}`}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* EQ and Gain */}
            <div className="eq-section">
              <div className="eq-knob-group">
                <div className="eq-knob">
                  <div className="knob-dial" style={{ transform: 'rotate(0deg)' }} />
                  <span className="knob-label">HIGH</span>
                </div>
                <div className="eq-knob">
                  <div className="knob-dial" style={{ transform: 'rotate(0deg)' }} />
                  <span className="knob-label">MID</span>
                </div>
                <div className="eq-knob">
                  <div className="knob-dial" style={{ transform: 'rotate(0deg)' }} />
                  <span className="knob-label">LOW</span>
                </div>
              </div>
              <div className="gain-control">
                <div className="gain-knob">
                  <div className="knob-dial" style={{ transform: `rotate(${leftGain * 270 - 135}deg)` }} />
                  <span className="knob-label">GAIN</span>
                </div>
              </div>
            </div>
          </div>

          {/* Center Mixer */}
          <div className="center-mixer">
            {/* VU Meters */}
            <div className="vu-meter-section">
              <div className="vu-meter-pair">
                <div className="vu-meter modern">
                  <div ref={leftVURef} className="vu-fill" style={{ height: `${Math.min(100, vuData.leftRMS * 2)}%` }} />
                </div>
                <div className="vu-meter modern">
                  <div ref={rightVURef} className="vu-fill" style={{ height: `${Math.min(100, vuData.rightRMS * 2)}%` }} />
                </div>
              </div>
            </div>

            {/* Master Level */}
            <div className="master-section">
              <div className="master-knob">
                <div className="knob-dial large" style={{ transform: 'rotate(-45deg)' }} />
                <span className="knob-label">MASTER</span>
              </div>
            </div>

            {/* Crossfader */}
            <div className="crossfader-section">
              <span className="crossfader-label">CROSSFADER</span>
              <div 
                className="crossfader-track"
                onMouseMove={handleCrossfaderMove}
                onClick={handleCrossfaderMove}
              >
                <div 
                  ref={crossfaderRef}
                  className="crossfader-handle"
                  style={{ left: `${crossfaderPosition * 100}%` }}
                />
              </div>
            </div>

            {/* Beat FX */}
            <div className="beat-fx-section">
              <button className={`fx-button ${selectedOption === 'amplify' ? 'active' : ''}`} onClick={handleAmplify}>
                <span className="fx-label">BEAT FX</span>
                <span className="fx-sublabel">AMPLIFY</span>
              </button>
            </div>
          </div>

          {/* Right Deck (Mirror of Left) */}
          <div className="deck-section right-deck">
            {/* Load/Cue Controls */}
            <div className="deck-controls-top">
              <button className="load-button">LOAD</button>
              <div className="tempo-display">
                <span className="tempo-value">120.0</span>
                <span className="tempo-unit">BPM</span>
              </div>
            </div>

            {/* Jog Wheel */}
            <div className="jog-wheel-container">
              <div 
                ref={rightJogRef}
                className="modern-jog-wheel"
              >
                <div className="jog-wheel-outer-ring" />
                <div className="jog-wheel-inner">
                  <div className="jog-wheel-center">
                    <div className="jog-wheel-logo">♪</div>
                  </div>
                </div>
                <div className="jog-wheel-markings">
                  {Array.from({ length: 60 }, (_, i) => (
                    <div 
                      key={i} 
                      className="jog-marking"
                      style={{ 
                        transform: `rotate(${i * 6}deg) translateY(-140px)`,
                        height: i % 5 === 0 ? '8px' : '4px'
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Hot Cue Pads */}
            <div className="cue-pads-section">
              <div className="cue-pads-row">
                {Array.from({ length: 4 }, (_, i) => (
                  <div
                    key={i}
                    className="modern-cue-pad"
                  >
                    <span className="pad-number">{i + 5}</span>
                    <span className="pad-label">CUE {i + 5}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* EQ and Gain */}
            <div className="eq-section">
              <div className="eq-knob-group">
                <div className="eq-knob">
                  <div className="knob-dial" style={{ transform: 'rotate(0deg)' }} />
                  <span className="knob-label">HIGH</span>
                </div>
                <div className="eq-knob">
                  <div className="knob-dial" style={{ transform: 'rotate(0deg)' }} />
                  <span className="knob-label">MID</span>
                </div>
                <div className="eq-knob">
                  <div className="knob-dial" style={{ transform: 'rotate(0deg)' }} />
                  <span className="knob-label">LOW</span>
                </div>
              </div>
              <div className="gain-control">
                <div className="gain-knob">
                  <div className="knob-dial" style={{ transform: `rotate(${rightGain * 270 - 135}deg)` }} />
                  <span className="knob-label">GAIN</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="modern-deck-footer">
          <div className="action-hint">
            <span className="hint-key">Q</span>
            <span className="hint-text">Hot Cue</span>
          </div>
          <div className="deck-info">
            <span className="deck-model">DDJ-FLX4 Style</span>
          </div>
          <div className="action-hint">
            <span className="hint-key">W</span>
            <span className="hint-text">Amplify</span>
          </div>
        </div>
      </div>

      {/* ARIA live region */}
      <div 
        aria-live="polite" 
        className="sr-only"
      >
        {selectedOption === 'hot-cue' && 'Hot cue activated'}
        {selectedOption === 'amplify' && 'Amplify effect engaged'}
      </div>
    </div>
  );
};
