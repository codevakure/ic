import { cn } from '~/utils/';

interface SpinnerProps {
  className?: string;
  size?: string | number;
  color?: string;
  bgOpacity?: number;
  speed?: number;
  variant?: 'default' | 'dots' | 'pulse';
}

export default function Spinner({
  className = 'm-auto',
  size = 20,
  color = 'currentColor',
  bgOpacity = 0.1,
  speed = 0.75,
  variant = 'default',
}: SpinnerProps) {
  const cssVars = {
    '--spinner-speed': `${speed}s`,
    '--spinner-color': color,
  } as React.CSSProperties;

  // Modern pulsing dots (ChatGPT style)
  if (variant === 'dots') {
    const dotSize = typeof size === 'number' ? size / 4 : 5;
    return (
      <div className={cn(className, 'flex items-center gap-1')} style={cssVars}>
        <style>{`
          @keyframes bounce-dot {
            0%, 80%, 100% { 
              transform: scale(0.6);
              opacity: 0.4;
            }
            40% { 
              transform: scale(1);
              opacity: 1;
            }
          }
          .dot {
            width: ${dotSize}px;
            height: ${dotSize}px;
            border-radius: 50%;
            background-color: var(--spinner-color);
            animation: bounce-dot 1.4s ease-in-out infinite;
          }
          .dot:nth-child(1) { animation-delay: 0s; }
          .dot:nth-child(2) { animation-delay: 0.16s; }
          .dot:nth-child(3) { animation-delay: 0.32s; }
        `}</style>
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    );
  }

  // Modern pulse animation
  if (variant === 'pulse') {
    return (
      <svg
        className={cn(className, 'spinner-pulse')}
        width={size}
        height={size}
        viewBox="0 0 40 40"
        xmlns="http://www.w3.org/2000/svg"
        style={cssVars}
      >
        <style>{`
          .spinner-pulse circle {
            transform-origin: center;
          }
          .spinner-pulse .ring {
            animation: pulse-ring 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
          .spinner-pulse .core {
            animation: pulse-core 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
          @keyframes pulse-ring {
            0%, 100% { 
              transform: scale(1);
              opacity: 0.3;
            }
            50% { 
              transform: scale(1.15);
              opacity: 0.1;
            }
          }
          @keyframes pulse-core {
            0%, 100% { 
              transform: scale(1);
              opacity: 1;
            }
            50% { 
              transform: scale(0.9);
              opacity: 0.7;
            }
          }
        `}</style>
        <circle
          className="ring"
          cx="20"
          cy="20"
          r="16"
          strokeWidth="2"
          fill="none"
          stroke={color}
        />
        <circle
          className="core"
          cx="20"
          cy="20"
          r="8"
          fill={color}
        />
      </svg>
    );
  }

  // Default: Modern gradient spinner with smooth animation
  return (
    <svg
      className={cn(className, 'spinner-modern')}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      style={cssVars}
    >
      <defs>
        <style type="text/css">{`
          .spinner-modern {
            transform-origin: center;
            overflow: visible;
            animation: spinner-rotate var(--spinner-speed) linear infinite;
          }
          @keyframes spinner-rotate {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <linearGradient id="spinner-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0" />
          <stop offset="50%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
      </defs>

      <circle
        cx="20"
        cy="20"
        r="15"
        strokeWidth="3"
        fill="none"
        stroke={color}
        strokeOpacity={bgOpacity}
      />
      <circle
        cx="20"
        cy="20"
        r="15"
        strokeWidth="3"
        fill="none"
        stroke="url(#spinner-gradient)"
        strokeDasharray="70 30"
        strokeLinecap="round"
      />
    </svg>
  );
}
