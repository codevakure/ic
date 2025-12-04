import React from 'react';

interface WatermarkProps {
  className?: string;
  width?: number;
  height?: number;
}

export const Watermark: React.FC<WatermarkProps> = ({ 
  className = '', 
  width = 50, 
  height = 50 
}) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width={width}
    height={height}
    viewBox="-15 -15 146 166"
  >
    <defs>
      {/* Subtle blue gradient for the R */}
      <linearGradient id="rGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#5A7BB8', stopOpacity: 1 }} />
        <stop offset="50%" style={{ stopColor: '#4A6BA3', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#3A5B93', stopOpacity: 1 }} />
      </linearGradient>
      
      {/* Subtle red gradient for the star */}
      <radialGradient id="starGradient" cx="50%" cy="40%" r="60%">
        <stop offset="0%" style={{ stopColor: '#E85A4F', stopOpacity: 1 }} />
        <stop offset="70%" style={{ stopColor: '#CC0000', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#B30000', stopOpacity: 1 }} />
      </radialGradient>
    </defs>
    
    <g>
      {/* Main "R" letter in gray */}
      <path 
        fill="#9CA3AF" 
        d="M69.8,98.91l-29.85-29.91h19.53c5.23,0,8.4-3.26,8.4-8.31s-3.17-8.31-8.4-8.31h-25.99v46.54h-15.77v-62.31h41.76c15,0,23.91,9.17,23.91,23.49,0,10.2-4.8,17.06-12.43,20.14l18.6,18.69h-19.76Z"
      />
      
      {/* Background elements in medium blue */}
      <path 
        fill="#6B7280" 
        d="M97.76,112.87H30.62l-23.1,23.09V22.63h69.18c-.38-1.64-.58-3.34-.58-5.07,0-.83.05-1.65.14-2.45H0v139.4l33.81-34.12h71.47v-17.38c-2.24-.49-5.01-1.55-7.52-3.84v13.7ZM97.77,39.25h-.01v28.35c.46-.55.96-1.07,1.48-1.58,1.8-1.71,3.83-3.19,6.04-4.38v-23.73c-2.34.87-4.87,1.34-7.51,1.34Z"
      />
      
      {/* Star in Texas gold/accent color */}
      <polygon 
        fill="url(#starGradient)" 
        points="108.91 15 100.43 15 97.81 6.93 95.19 15 86.72 15 93.57 19.98 90.95 28.04 97.81 23.06 104.67 28.04 102.05 19.98 108.91 15"
      />
      
      {/* Complete circle outline with no gaps */}
      <circle 
        cx="97.7" 
        cy="17.6" 
        r="17.6" 
        fill="none" 
        stroke="#9CA3AF" 
        strokeWidth="2"
      />
    </g>
  </svg>
);

export default Watermark;
