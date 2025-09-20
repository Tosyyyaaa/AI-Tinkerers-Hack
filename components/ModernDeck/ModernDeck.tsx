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
                <div className="brand-text">MusicBuddy</div>
              </div>
              <div className="deck-status">
                <div className={`status-indicator ${isPlaying ? 'playing' : 'stopped'}`} />
                <span className="status-text">{isPlaying ? 'PLAYING' : 'LOCKED IN'}</span>
              </div>
            </div>

        {/* Main Control Area */}
        <div className="modern-deck-main">
          
          {/* Left Deck */}
          <div className="deck-section left-deck">

            {/* Jog Wheel */}
            <div className="jog-wheel-container">
              <div className="jog-wheel-text">I want to control the vibes</div>
              <div 
                ref={leftJogRef}
                className="modern-jog-wheel"
                onClick={handleHotCue}
              >
                <div className="jog-wheel-outer-ring" />
                <div className="jog-wheel-inner">
                  <div className="jog-wheel-center">
                    <div className="jog-wheel-logo"></div>
                  </div>
                </div>
              </div>
            </div>


          </div>

          {/* Center Mixer - Pioneer Style */}
          <div className="center-mixer pioneer-style">
            <div className="mixer-channels-row">
              {/* Channel 1 */}
              <div className="mixer-channel">
                {/* EQ Knobs */}
                <div className="eq-knobs-vertical">
                  <div className="eq-knob-container">
                    <div className="pioneer-knob">
                      <div className="knob-dial" style={{ transform: 'rotate(0deg)' }} />
                    </div>
                    <span className="knob-label">LOW</span>
                  </div>
                  <div className="eq-knob-container">
                    <div className="pioneer-knob">
                      <div className="knob-dial" style={{ transform: 'rotate(0deg)' }} />
                    </div>
                    <span className="knob-label">CFX</span>
                  </div>
                  <div className="eq-knob-container">
                    <div className="pioneer-knob">
                      <div className="knob-dial" style={{ transform: 'rotate(0deg)' }} />
                    </div>
                    <span className="knob-label">LOW</span>
                    <span className="knob-sublabel">HI</span>
                  </div>
                </div>
                
                {/* CUE Button */}
                <div className="cue-button-container">
                  <button className="pioneer-cue-button" onClick={handleHotCue}>
                    <span className="cue-text">CUE</span>
                  </button>
                  <span className="channel-number">1</span>
                </div>
                
              </div>

              {/* Channel 2 */}
              <div className="mixer-channel">
                {/* EQ Knobs */}
                <div className="eq-knobs-vertical">
                  <div className="eq-knob-container">
                    <div className="pioneer-knob">
                      <div className="knob-dial" style={{ transform: 'rotate(0deg)' }} />
                    </div>
                    <span className="knob-label">LOW</span>
                  </div>
                  <div className="eq-knob-container">
                    <div className="pioneer-knob">
                      <div className="knob-dial" style={{ transform: 'rotate(0deg)' }} />
                    </div>
                    <span className="knob-label">CFX</span>
                  </div>
                  <div className="eq-knob-container">
                    <div className="pioneer-knob">
                      <div className="knob-dial" style={{ transform: 'rotate(0deg)' }} />
                    </div>
                    <span className="knob-label">LOW</span>
                    <span className="knob-sublabel">HI</span>
                  </div>
                </div>
                
                {/* CUE Button */}
                <div className="cue-button-container">
                  <button className="pioneer-cue-button" onClick={handleAmplify}>
                    <span className="cue-text">CUE</span>
                  </button>
                  <span className="channel-number">2</span>
                </div>
                
              </div>
            </div>

            {/* Crossfader Section - Now at Bottom */}
            <div className="crossfader-section-pioneer">
              <div className="crossfader-container">
                <div 
                  className="crossfader-track-pioneer"
                  onMouseMove={handleCrossfaderMove}
                  onClick={handleCrossfaderMove}
                >
                  <div 
                    ref={crossfaderRef}
                    className="crossfader-handle-pioneer"
                    style={{ left: `${crossfaderPosition * 100}%` }}
                  />
                  <div className="crossfader-markings">
                    {Array.from({ length: 5 }, (_, i) => (
                      <div key={i} className="crossfader-mark" style={{ left: `${i * 25}%` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Deck (Mirror of Left) */}
          <div className="deck-section right-deck">

            {/* Jog Wheel */}
            <div className="jog-wheel-container">
              <div className="jog-wheel-text">Investigate the vibes for me</div>
              <div 
                ref={rightJogRef}
                className="modern-jog-wheel"
                onClick={handleAmplify}
              >
                <div className="jog-wheel-outer-ring" />
                <div className="jog-wheel-inner">
                  <div className="jog-wheel-center">
                    <div className="jog-wheel-logo"></div>
                  </div>
                </div>
              </div>
            </div>


          </div>
        </div>

        {/* Bottom Track Bar */}
        <div className="modern-deck-footer">
          <div className="track-bar-container">
            <div className="track-bar">
              <div className="track-waveform">
                <div className="waveform-bars">
                  {Array.from({ length: 32 }, (_, i) => (
                    <div 
                      key={i} 
                      className="waveform-bar"
                      style={{ 
                        height: `${Math.random() * 60 + 20}%`,
                        opacity: selectedOption === 'hot-cue' ? 0.8 : 0.4
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="track-divider">
                <div className="team-names">
                  <div className="team-title">Created by</div>
                  <div className="team-members">Antonina Sukhanova • Ayomi Igandan • Nikolai Malozemov</div>
                </div>
              </div>
              <div className="track-waveform">
                <div className="waveform-bars">
                  {Array.from({ length: 32 }, (_, i) => (
                    <div 
                      key={i} 
                      className="waveform-bar"
                      style={{ 
                        height: `${Math.random() * 60 + 20}%`,
                        opacity: selectedOption === 'amplify' ? 0.8 : 0.4
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
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
