/**
 * Holiday Overlay Component
 * 
 * Displays subtle festive animations on page load for active holidays.
 * Shows gentle falling snowflakes for a configurable duration then fades out.
 * For Christmas (Dec 15 - Jan 1), includes Santa's sleigh flying across the bottom.
 * 
 * Usage: Add <HolidayOverlay /> to App.jsx as a sibling to main content
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { getActiveHoliday, isSantaActive, type Holiday, type HolidayEffect } from './holidayConfig';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  speed: number;
  wobbleSpeed: number;
  wobbleAmount: number;
  opacity: number;
  fadeAt: number; // percentage where this flake starts fading (50-100)
  char: string;
}

interface SleighState {
  x: number;
  y: number;
  bobOffset: number;
}

interface HolidayOverlayProps {
  /** Duration in milliseconds to show the animation (default: 5000) */
  duration?: number;
  /** Number of particles to generate (default: 15) */
  particleCount?: number;
}

// Actual snowflake characters
const SNOWFLAKES = ['❄', '❅', '❆', '✻', '✼', '❊'];

// Santa's Sleigh Component - SVG-based for smooth animation
// Traveling right to left: Reindeer face LEFT, pulling sleigh behind them
const SantaSleigh: React.FC<{ isDarkMode: boolean; legFrame: number }> = ({ isDarkMode, legFrame }) => {
  const santaRed = '#c41e3a';
  const sleighRed = '#8B0000';
  const gold = '#DAA520';
  const brown1 = '#8B4513';
  const brown2 = '#A0522D';
  const darkBrown = '#5D3A1A';
  
  return (
    <svg width="280" height="70" viewBox="0 0 280 70" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* === REINDEER 1 (Rudolph - front, facing LEFT) === */}
      <g transform="translate(5, 5)">
        {/* Body */}
        <ellipse cx="45" cy="28" rx="18" ry="12" fill={brown1} />
        {/* Neck - angled toward head on left */}
        <ellipse cx="27" cy="20" rx="6" ry="10" fill={brown1} transform="rotate(-15, 27, 20)" />
        {/* Head - on left side */}
        <ellipse cx="15" cy="12" rx="10" ry="7" fill={brown1} />
        {/* Snout - pointing left */}
        <ellipse cx="5" cy="14" rx="5" ry="4" fill={brown2} />
        {/* RUDOLPH'S RED NOSE - glowing! */}
        <circle cx="0" cy="14" r="3" fill="#ff0000" />
        <circle cx="0" cy="14" r="6" fill="#ff0000" opacity="0.3" />
        {/* Eye */}
        <circle cx="13" cy="10" r="2" fill="#1a1a1a" />
        {/* Ear */}
        <ellipse cx="22" cy="5" rx="3" ry="5" fill={brown1} transform="rotate(20, 22, 5)" />
        {/* Antlers - pointing up and back */}
        <path d="M18 4 L 20 -6 L 24 -2 M20 -6 L 16 -10" stroke={darkBrown} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M24 2 L 28 -8 L 32 -4 M28 -8 L 24 -12" stroke={darkBrown} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Harness */}
        <path d="M20 24 L 12 18 L 8 24" stroke={gold} strokeWidth="2" fill="none" />
        {/* Legs - animated galloping */}
        <line x1="35" y1="38" x2={legFrame === 0 ? "28" : "40"} y2="58" stroke={darkBrown} strokeWidth="3" strokeLinecap="round" />
        <line x1="42" y1="38" x2={legFrame === 0 ? "50" : "36"} y2="58" stroke={darkBrown} strokeWidth="3" strokeLinecap="round" />
        <line x1="50" y1="38" x2={legFrame === 0 ? "44" : "56"} y2="58" stroke={darkBrown} strokeWidth="3" strokeLinecap="round" />
        <line x1="56" y1="38" x2={legFrame === 0 ? "64" : "52"} y2="58" stroke={darkBrown} strokeWidth="3" strokeLinecap="round" />
        {/* Tail - on right */}
        <ellipse cx="63" cy="26" rx="4" ry="3" fill={brown2} />
      </g>
      
      {/* === REINDEER 2 (second, facing LEFT) === */}
      <g transform="translate(65, 8)">
        {/* Body */}
        <ellipse cx="45" cy="28" rx="18" ry="12" fill={brown2} />
        {/* Neck */}
        <ellipse cx="27" cy="20" rx="6" ry="10" fill={brown2} transform="rotate(-15, 27, 20)" />
        {/* Head */}
        <ellipse cx="15" cy="12" rx="10" ry="7" fill={brown2} />
        {/* Snout */}
        <ellipse cx="5" cy="14" rx="5" ry="4" fill={brown1} />
        {/* Nose */}
        <circle cx="1" cy="14" r="2" fill="#8B0000" />
        {/* Eye */}
        <circle cx="13" cy="10" r="2" fill="#1a1a1a" />
        {/* Ear */}
        <ellipse cx="22" cy="5" rx="3" ry="5" fill={brown2} transform="rotate(20, 22, 5)" />
        {/* Antlers */}
        <path d="M18 4 L 20 -6 L 24 -2 M20 -6 L 16 -10" stroke={darkBrown} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M24 2 L 28 -8 L 32 -4 M28 -8 L 24 -12" stroke={darkBrown} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Harness */}
        <path d="M20 24 L 12 18 L 8 24" stroke={gold} strokeWidth="2" fill="none" />
        {/* Legs - animated (opposite phase) */}
        <line x1="35" y1="38" x2={legFrame === 1 ? "28" : "40"} y2="55" stroke={darkBrown} strokeWidth="3" strokeLinecap="round" />
        <line x1="42" y1="38" x2={legFrame === 1 ? "50" : "36"} y2="55" stroke={darkBrown} strokeWidth="3" strokeLinecap="round" />
        <line x1="50" y1="38" x2={legFrame === 1 ? "44" : "56"} y2="55" stroke={darkBrown} strokeWidth="3" strokeLinecap="round" />
        <line x1="56" y1="38" x2={legFrame === 1 ? "64" : "52"} y2="55" stroke={darkBrown} strokeWidth="3" strokeLinecap="round" />
        {/* Tail */}
        <ellipse cx="63" cy="26" rx="4" ry="3" fill={brown1} />
      </g>
      
      {/* === REINS (connecting reindeer to sleigh) === */}
      <path d="M70 30 Q 100 25, 130 32 Q 160 28, 185 35" stroke={gold} strokeWidth="2" fill="none" />
      <path d="M70 34 Q 100 30, 130 36 Q 160 32, 185 38" stroke={gold} strokeWidth="2" fill="none" />
      
      {/* === SLEIGH (back-right, being pulled) === */}
      <g transform="translate(175, 15)">
        {/* Sleigh front curl - on left side now */}
        <path d="M-3 25 C -10 20, -10 38, -3 42" stroke={sleighRed} strokeWidth="4" fill="none" />
        {/* Sleigh body - curved elegant shape */}
        <path 
          d="M0 25 C 5 15, 15 10, 30 10 L 70 10 C 85 10, 90 20, 88 30 L 85 40 C 80 48, 60 50, 40 50 L 10 50 C -5 48, -5 35, 0 25" 
          fill={sleighRed} 
        />
        {/* Sleigh runner */}
        <path 
          d="M-5 52 C 0 48, 10 46, 30 46 L 75 46 C 90 46, 95 50, 92 55 L -8 55 C -10 53, -8 52, -5 52" 
          fill={gold} 
        />
        {/* Runner curl at back (right side) */}
        <path d="M92 52 C 98 52, 100 48, 98 44" stroke={gold} strokeWidth="3" fill="none" />
        {/* Sleigh rim detail */}
        <path d="M5 15 C 20 12, 60 12, 80 18" stroke={gold} strokeWidth="2" fill="none" />
        {/* Gift sack */}
        <ellipse cx="65" cy="30" rx="15" ry="18" fill="#654321" />
        <path d="M55 15 Q 65 8 75 15" stroke="#654321" strokeWidth="4" fill="none" />
      </g>
      
      {/* === SANTA (sitting in sleigh, facing left) === */}
      <g transform="translate(185, 2)">
        {/* Body */}
        <ellipse cx="20" cy="32" rx="14" ry="16" fill={santaRed} />
        {/* White fur trim at bottom */}
        <ellipse cx="20" cy="45" rx="14" ry="4" fill="white" />
        {/* Belt */}
        <rect x="6" y="30" width="28" height="6" fill="#1a1a1a" />
        <rect x="16" y="29" width="8" height="8" rx="1" fill={gold} />
        {/* Arm holding reins (extends toward reindeer - left) */}
        <ellipse cx="8" cy="20" rx="5" ry="9" fill={santaRed} transform="rotate(-25, 8, 20)" />
        {/* Gloved hand holding reins */}
        <circle cx="2" cy="14" r="4" fill="white" />
        {/* Head */}
        <circle cx="18" cy="8" r="10" fill="#FFE4C4" />
        {/* Beard */}
        <path d="M8 10 Q 6 20, 11 25 Q 18 28, 25 25 Q 30 20, 28 10" fill="white" />
        {/* Rosy cheeks - on left side (facing left) */}
        <circle cx="10" cy="10" r="2" fill="#FFB6C1" opacity="0.6" />
        {/* Eye - on left */}
        <circle cx="12" cy="6" r="1.5" fill="#1a1a1a" />
        {/* Hat */}
        <path d="M8 5 Q 6 -8, 18 -10 Q 30 -8, 28 5" fill={santaRed} />
        <ellipse cx="18" cy="5" rx="12" ry="4" fill="white" />
        <circle cx="6" cy="-10" r="4" fill="white" />
      </g>
    </svg>
  );
};

const HolidayOverlay: React.FC<HolidayOverlayProps> = ({
  duration = 5000,
  particleCount = 15,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [holiday, setHoliday] = useState<Holiday | null>(null);
  const [sleigh, setSleigh] = useState<SleighState>({ x: 110, y: 0, bobOffset: 0 }); // Start off-screen right
  const [legFrame, setLegFrame] = useState(0);
  const initialized = useRef(false);
  const animationRef = useRef<number | null>(null);
  const sleighAnimationRef = useRef<number | null>(null);
  const sleighStarted = useRef(false); // Prevent double-start

  // Generate snowflakes with natural variation
  const generateParticles = useCallback((): Particle[] => {
    const newParticles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      // Vary sizes - some small, some medium, few larger
      const sizeRand = Math.random();
      let size: number;
      if (sizeRand < 0.5) {
        size = 12 + Math.random() * 6; // Small: 12-18px (50%)
      } else if (sizeRand < 0.85) {
        size = 18 + Math.random() * 8; // Medium: 18-26px (35%)
      } else {
        size = 26 + Math.random() * 10; // Large: 26-36px (15%)
      }

      newParticles.push({
        id: i,
        x: Math.random() * 100,
        y: -5 - Math.random() * 30, // Start above viewport, staggered
        size,
        color: '#ffffff',
        speed: 0.15 + Math.random() * 0.1, // Slow gentle fall
        wobbleSpeed: 0.5 + Math.random() * 1, // How fast it sways
        wobbleAmount: 0.3 + Math.random() * 0.5, // How much it sways
        opacity: 0.6 + Math.random() * 0.4,
        fadeAt: 95, // Fade near the bottom
        char: SNOWFLAKES[Math.floor(Math.random() * SNOWFLAKES.length)],
      });
    }

    return newParticles;
  }, [particleCount]);

  // Initialize on mount - runs only once
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Check config to see if holiday theme is allowed
    const initHoliday = async () => {
      try {
        const response = await fetch('/api/config');
        const config = await response.json();
        
        if (!config.allowHolidayTheme) {
          return;
        }
      } catch (error) {
        // If config fetch fails, default to showing the animation
        console.warn('[HolidayOverlay] Could not fetch config, defaulting to show');
      }

      const activeHoliday = getActiveHoliday();
      if (!activeHoliday) {
        return;
      }
      
      setHoliday(activeHoliday);
      setParticles(generateParticles());
      setIsVisible(true);

      // Start fade out before duration ends
      setTimeout(() => {
        setIsFading(true);
      }, duration - 1000);

      // Hide completely after duration
      setTimeout(() => {
        setIsVisible(false);
      }, duration);
    };

    initHoliday();
  }, [duration, generateParticles]);

  // Animate particles - natural falling with gentle sway
  useEffect(() => {
    if (!isVisible || particles.length === 0) return;

    let lastTime = performance.now();
    
    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 16;
      lastTime = currentTime;

      setParticles(prev => prev.map(p => {
        const newY = p.y + p.speed * deltaTime;
        
        // Natural swaying motion using sine wave
        const sway = Math.sin((currentTime / 1000) * p.wobbleSpeed + p.id) * p.wobbleAmount;
        const newX = p.x + sway * 0.05 * deltaTime;
        
        // Fade slightly near bottom
        let newOpacity = p.opacity;
        if (newY > 90) {
          newOpacity = p.opacity * (1 - (newY - 90) / 15);
        }
        
        // Reset when off screen
        if (newY > 105) {
          return {
            ...p,
            y: -5 - Math.random() * 15,
            x: Math.random() * 100,
            opacity: 0.6 + Math.random() * 0.4,
          };
        }
        
        return {
          ...p,
          y: newY,
          x: Math.max(0, Math.min(100, newX)),
          opacity: newOpacity,
        };
      }));

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isVisible, particles.length]);

  // Animate Santa's sleigh - flies across bottom of screen (RIGHT to LEFT)
  // Santa appears Dec 15 - Jan 1
  const showSanta = isSantaActive();
  
  useEffect(() => {
    if (!isVisible || !showSanta) return;
    if (sleighStarted.current) return; // Prevent double animation
    sleighStarted.current = true;

    const startTime = performance.now();
    const sleighDuration = duration * 0.85; // Complete journey in 85% of total duration
    let lastLegSwitch = startTime;
    
    const animateSleigh = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / sleighDuration, 1);
      
      // Smooth linear movement - no easing for consistent speed
      // Move from right (100%) to left (-30%)
      const x = 100 - progress * 130;
      
      // Gentle bobbing motion
      const bobOffset = Math.sin(currentTime / 400) * 2;
      
      setSleigh({ x, y: bobOffset, bobOffset });
      
      // Animate reindeer legs - switch every 120ms for galloping effect
      if (currentTime - lastLegSwitch > 120) {
        setLegFrame(prev => (prev + 1) % 2);
        lastLegSwitch = currentTime;
      }

      if (progress < 1) {
        sleighAnimationRef.current = requestAnimationFrame(animateSleigh);
      }
    };

    sleighAnimationRef.current = requestAnimationFrame(animateSleigh);

    return () => {
      if (sleighAnimationRef.current) {
        cancelAnimationFrame(sleighAnimationRef.current);
      }
    };
  }, [isVisible, showSanta, duration]);

  if (!isVisible || !holiday) {
    return null;
  }

  // Check if dark mode - snowflakes need different styling
  const isDarkMode = typeof document !== 'undefined' && 
    document.documentElement.classList.contains('dark');

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-[9999] overflow-hidden ${
        isFading ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ transition: 'opacity 2s ease-out' }}
      aria-hidden="true"
    >
      {/* Snowflakes */}
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute select-none"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            fontSize: `${particle.size}px`,
            color: isDarkMode ? '#ffffff' : '#a8d4f0',
            opacity: particle.opacity,
            textShadow: isDarkMode 
              ? '0 0 4px rgba(255,255,255,0.9), 0 0 8px rgba(200,220,255,0.5)'
              : '0 0 3px rgba(100,150,200,0.6), 0 0 6px rgba(150,180,220,0.3)',
            filter: particle.size > 24 ? 'blur(0.5px)' : 'none',
            willChange: 'transform, top, left, opacity',
          }}
        >
          {particle.char}
        </div>
      ))}

      {/* Santa's Sleigh with Reindeer - SVG for smooth animation (Dec 15 - Jan 1) */}
      {showSanta && (
        <div
          className="absolute select-none"
          style={{
            left: `${sleigh.x}%`,
            bottom: `${10 + sleigh.bobOffset}px`,
            filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.4))',
            willChange: 'transform, left, bottom',
          }}
        >
          <SantaSleigh isDarkMode={isDarkMode} legFrame={legFrame} />
        </div>
      )}
    </div>
  );
};

export default HolidayOverlay;
