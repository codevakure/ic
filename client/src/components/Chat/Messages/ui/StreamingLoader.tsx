import { memo } from 'react';

/**
 * Branded streaming loader with red star and gradient arc rotation
 * Modern comet-tail effect that fades from solid to transparent
 */
const StreamingLoader = memo(() => {
  return (
    <div className="streaming-loader flex items-center py-0.5">
      <svg
        width="24"
        height="24"
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-text-primary"
      >
        <defs>
          {/* Red gradient for star */}
          <linearGradient id="streaming-star-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>

          {/* Gradient for the comet-tail arc effect */}
          <linearGradient id="arc-gradient" gradientUnits="userSpaceOnUse" x1="18" y1="2" x2="18" y2="34">
            <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
            <stop offset="60%" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>

          {/* Glow filter for star */}
          <filter id="streaming-star-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.8" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Rotating gradient arc - comet tail effect */}
        <g style={{ transformOrigin: '18px 18px' }}>
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="url(#arc-gradient)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="70 30"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 18 18"
              to="360 18 18"
              dur="1.2s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* Red star in center */}
        <polygon 
          points="18 8 20.2 14 27 14 21.5 18 23.5 25 18 21 12.5 25 14.5 18 9 14 15.8 14"
          fill="url(#streaming-star-gradient)"
          filter="url(#streaming-star-glow)"
        >
          <animate 
            attributeName="opacity" 
            values="0.9;1;0.9" 
            dur="1.5s" 
            repeatCount="indefinite" 
          />
        </polygon>
      </svg>
    </div>
  );
});

StreamingLoader.displayName = 'StreamingLoader';

export default StreamingLoader;
