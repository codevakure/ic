import { memo } from 'react';

/**
 * Claude-style animated sparkle/asterisk loader
 * Shows while the AI is generating a response
 */
const StreamingLoader = memo(() => {
  return (
    <div className="streaming-loader flex items-center py-2">
      <svg
        className="streaming-sparkle"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Center dot */}
        <circle cx="12" cy="12" r="1.5" fill="currentColor" className="sparkle-center" />
        
        {/* 8 rays emanating from center */}
        {/* Top */}
        <line x1="12" y1="2" x2="12" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="sparkle-ray ray-1" />
        {/* Top-right */}
        <line x1="19.07" y1="4.93" x2="14.24" y2="9.76" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="sparkle-ray ray-2" />
        {/* Right */}
        <line x1="22" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="sparkle-ray ray-3" />
        {/* Bottom-right */}
        <line x1="19.07" y1="19.07" x2="14.24" y2="14.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="sparkle-ray ray-4" />
        {/* Bottom */}
        <line x1="12" y1="22" x2="12" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="sparkle-ray ray-5" />
        {/* Bottom-left */}
        <line x1="4.93" y1="19.07" x2="9.76" y2="14.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="sparkle-ray ray-6" />
        {/* Left */}
        <line x1="2" y1="12" x2="8" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="sparkle-ray ray-7" />
        {/* Top-left */}
        <line x1="4.93" y1="4.93" x2="9.76" y2="9.76" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="sparkle-ray ray-8" />
      </svg>
    </div>
  );
});

StreamingLoader.displayName = 'StreamingLoader';

export default StreamingLoader;
