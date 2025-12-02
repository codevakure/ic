export default function CSSPaths() {
  return (
    <>
      {/* Main document body */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="#264DE4"
        stroke="none"
      />
      
      {/* Folded corner */}
      <path
        d="M23 4V12H29"
        fill="#89A7F7"
        stroke="none"
      />
      
      {/* CSS curly braces and content */}
      <g fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
        <path d="M12 16C11 16 10 17 10 18V19.5C10 20.5 9 21 9 21C9 21 10 21.5 10 22.5V24C10 25 11 26 12 26" />
        <path d="M24 16C25 16 26 17 26 18V19.5C26 20.5 27 21 27 21C27 21 26 21.5 26 22.5V24C26 25 25 26 24 26" />
      </g>
      
      {/* CSS hash selector */}
      <g fill="white">
        <rect x="15" y="18" width="6" height="2" rx="0.5" />
        <rect x="16" y="22" width="4" height="1.5" rx="0.5" />
      </g>
      
      {/* CSS text label */}
      <text
        x="18"
        y="30"
        fontSize="5"
        fontWeight="700"
        textAnchor="middle"
        fill="white"
        fontFamily="Arial, sans-serif"
      >
        CSS
      </text>
      
      {/* Document outline */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="none"
        stroke="#1A3BB8"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Corner fold line */}
      <path
        d="M23 4V12H29"
        fill="none"
        stroke="#1A3BB8"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}
