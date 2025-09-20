'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import { useGrain } from '@/lib/hooks/useGrain';
import './VinylChoice.css';

export interface VinylOption {
  id: string;
  label: string;
  color?: string;
}

export interface VinylChoiceProps {
  options: VinylOption[];
  onSelect: (id: string) => void;
  sleeveImageRef?: string;
}

/**
 * Neo-futuristic vinyl choice component with GSAP animations
 * Features responsive design, accessibility, and smooth interactions
 */
export const VinylChoice: React.FC<VinylChoiceProps> = ({
  options = [
    { id: 'create', label: 'Create', color: '#FFD700' },
    { id: 'remix', label: 'Remix', color: '#FFD700' }
  ],
  onSelect,
  sleeveImageRef
}) => {
  // Refs for DOM elements and animations
  const containerRef = useRef<HTMLDivElement>(null);
  const leftVinylRef = useRef<HTMLDivElement>(null);
  const rightVinylRef = useRef<HTMLDivElement>(null);
  const leftLabelRef = useRef<HTMLDivElement>(null);
  const rightLabelRef = useRef<HTMLDivElement>(null);
  
  // Grain texture canvas
  const grainCanvasRef = useGrain(0.08, 0.5, 2);

  /**
   * Initialize GSAP and set initial states
   */
  useEffect(() => {
    if (!leftVinylRef.current || !rightVinylRef.current) return;

    // Set initial positions for vinyls
    gsap.set([leftVinylRef.current, rightVinylRef.current], {
      scale: 1,
      rotation: 0,
      transformOrigin: 'center center',
    });

    // Show labels immediately
    gsap.set([leftLabelRef.current, rightLabelRef.current], {
      opacity: 1,
      y: 0,
    });

    // Initial entrance animation
    gsap.fromTo([leftVinylRef.current, rightVinylRef.current], {
      scale: 0.8,
      opacity: 0,
      y: 20,
    }, {
      scale: 1,
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: 'power3.out',
      stagger: 0.2,
      delay: 0.5,
    });

  }, []);


  /**
   * Handle vinyl record selection
   */
  const handleVinylSelect = useCallback((optionId: string, vinylRef: React.RefObject<HTMLDivElement | null>) => {
    if (!vinylRef.current) return;

    // Pulse animation for selected vinyl
    gsap.to(vinylRef.current, {
      scale: 1.1,
      duration: 0.15,
      yoyo: true,
      repeat: 1,
      ease: 'power2.out',
      onComplete: () => {
        onSelect(optionId);
      }
    });
  }, [onSelect]);

  /**
   * Handle individual vinyl hover
   */
  const handleVinylHover = useCallback((vinylRef: React.RefObject<HTMLDivElement | null>, isHover: boolean) => {
    if (!vinylRef.current) return;

    gsap.to(vinylRef.current, {
      y: isHover ? -6 : 0,
      rotation: isHover ? (vinylRef === leftVinylRef ? -5 : 5) : 0,
      scale: isHover ? 1.05 : 1,
      duration: 0.3,
      ease: 'power2.out',
    });
  }, []);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent, optionId: string, vinylRef: React.RefObject<HTMLDivElement | null>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleVinylSelect(optionId, vinylRef);
    }
  }, [handleVinylSelect]);

  // Set up grain canvas background
  useEffect(() => {
    if (grainCanvasRef.current && containerRef.current) {
      const canvas = grainCanvasRef.current;
      const url = canvas.toDataURL();
      const grainElement = containerRef.current.querySelector('.bg-grain') as HTMLElement;
      if (grainElement) {
        grainElement.style.backgroundImage = `url(${url})`;
      }
    }
  }, [grainCanvasRef]);

  return (
    <div 
      ref={containerRef}
      className="vinyl-choice-container"
      role="group"
      aria-label="Choose a record option"
    >
      {/* Old neo-futuristic background */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 20% 80%, #0a0a0f 0%, #1a1a2e 30%, #0f0f1a 70%, #000008 100%)'
        }}
      />

      {/* Layered gradient shapes */}
      <div
        className="absolute inset-0"
        style={{
          background: 'conic-gradient(from 45deg at 30% 70%, #4a0e4e 0deg, #1a1a2e 90deg, #2a4a8a 180deg, #6a2c70 270deg, #4a0e4e 360deg)',
          clipPath: 'polygon(0% 60%, 100% 30%, 100% 100%, 0% 100%)',
          opacity: 0.4
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: 'conic-gradient(from 135deg at 70% 30%, #2a4a8a 0deg, #6a2c70 90deg, #4a0e4e 180deg, #1a1a2e 270deg, #2a4a8a 360deg)',
          clipPath: 'polygon(0% 0%, 100% 0%, 100% 70%, 0% 40%)',
          opacity: 0.3
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(45deg, #E05A91 0%, #6C4EDB 25%, #2B2E89 50%, #4a0e4e 75%, #E05A91 100%)',
          clipPath: 'ellipse(60% 40% at 20% 60%)',
          opacity: 0.2
        }}
      />

      {/* Ambient glow layers */}
      <div
        className="absolute top-1/4 left-1/3 w-[600px] h-[400px] opacity-8 animate-pulse"
        style={{
          background: 'radial-gradient(ellipse at center, #6C4EDB 0%, transparent 60%)',
          filter: 'blur(80px)',
          animationDelay: '1s'
        }}
      />
      <div
        className="absolute bottom-1/3 right-1/4 w-[500px] h-[300px] opacity-6 animate-pulse"
        style={{
          background: 'radial-gradient(ellipse at center, #E05A91 0%, transparent 60%)',
          filter: 'blur(100px)',
          animationDelay: '3s'
        }}
      />

      {/* Heavy grain texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.15] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(255,255,255,0.8) 0.5px, transparent 0.5px),
            radial-gradient(circle at 80% 70%, rgba(255,255,255,0.6) 0.8px, transparent 0.8px),
            radial-gradient(circle at 40% 80%, rgba(255,255,255,0.4) 1px, transparent 1px),
            radial-gradient(circle at 60% 20%, rgba(255,255,255,0.3) 0.3px, transparent 0.3px),
            radial-gradient(circle at 10% 60%, rgba(255,255,255,0.5) 0.6px, transparent 0.6px),
            radial-gradient(circle at 90% 40%, rgba(255,255,255,0.7) 0.4px, transparent 0.4px)
          `,
          backgroundSize: '3px 3px, 5px 5px, 4px 4px, 2px 2px, 6px 6px, 3px 3px',
          backgroundPosition: '0 0, 2px 2px, 1px 1px, 3px 3px, 1px 2px, 2px 1px'
        }}
      />

      {/* Subtle scanlines for neo-futuristic feel */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none animate-scanlines"
        style={{
          backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(91, 200, 232, 0.1) 50%, transparent 100%)',
          backgroundSize: '4px 100%'
        }}
      />

      {/* Color noise overlay */}
      <div
        className="absolute inset-0 opacity-[0.08] pointer-events-none mix-blend-color-dodge"
        style={{
          backgroundImage: `
            radial-gradient(circle at 25% 25%, #E05A91 1px, transparent 1px),
            radial-gradient(circle at 75% 75%, #6C4EDB 0.8px, transparent 0.8px),
            radial-gradient(circle at 50% 80%, #5BC8E8 0.6px, transparent 0.6px)
          `,
          backgroundSize: '8px 8px, 12px 12px, 6px 6px',
          backgroundPosition: '0 0, 4px 4px, 2px 2px'
        }}
      />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-30 p-6">
        <div className="flex items-center justify-start">
          <div
            className="px-6 py-3"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              MusicBuddy
            </h1>
          </div>
        </div>
      </header>
      
      {/* Hidden canvas for grain texture */}
      <canvas
        ref={grainCanvasRef}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      
      {/* Main content - just the two vinyls */}
      <div className="vinyl-choice-content">
        {/* Left vinyl record */}
        <div
          ref={leftVinylRef}
          className="vinyl-record"
          style={{ 
            position: 'absolute',
            left: '25%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 20
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleVinylSelect(options[0]?.id || 'create', leftVinylRef);
          }}
          onMouseEnter={() => handleVinylHover(leftVinylRef, true)}
          onMouseLeave={() => handleVinylHover(leftVinylRef, false)}
          onKeyDown={(e) => handleKeyDown(e, options[0]?.id || 'create', leftVinylRef)}
          tabIndex={0}
          role="button"
          aria-label={`Choose ${options[0]?.label || 'Create'} option`}
        >
          <div className="vinyl-grooves" />
            <div 
              className="vinyl-label"
              style={{ 
                background: options[0]?.color || '#FFD700'
              }}
            />
          <div className="vinyl-center-hole" />
          
          {/* Label */}
          <div ref={leftLabelRef} className="option-label">
            {options[0]?.label || 'Create'}
          </div>
        </div>
        
        {/* Right vinyl record */}
        <div
          ref={rightVinylRef}
          className="vinyl-record"
          style={{ 
            position: 'absolute',
            right: '25%',
            top: '50%',
            transform: 'translate(50%, -50%)',
            zIndex: 20
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleVinylSelect(options[1]?.id || 'remix', rightVinylRef);
          }}
          onMouseEnter={() => handleVinylHover(rightVinylRef, true)}
          onMouseLeave={() => handleVinylHover(rightVinylRef, false)}
          onKeyDown={(e) => handleKeyDown(e, options[1]?.id || 'remix', rightVinylRef)}
          tabIndex={0}
          role="button"
          aria-label={`Choose ${options[1]?.label || 'Remix'} option`}
        >
          <div className="vinyl-grooves" />
            <div 
              className="vinyl-label"
              style={{ 
                background: options[1]?.color || '#FFD700'
              }}
            />
          <div className="vinyl-center-hole" />
          
          {/* Label */}
          <div ref={rightLabelRef} className="option-label">
            {options[1]?.label || 'Remix'}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer 
        className="absolute bottom-0 left-0 right-0 z-30 py-4 text-center"
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        <p className="text-xs md:text-sm text-white/70 font-light tracking-wide">
          Created by{' '}
          <span className="text-white/90 font-medium">Antonina Sukhanova</span>,{' '}
          <span className="text-white/90 font-medium">Ayomi Igandan</span>, &{' '}
          <span className="text-white/90 font-medium">Nikolai Malozemov</span>
        </p>
      </footer>
    </div>
  );
};
