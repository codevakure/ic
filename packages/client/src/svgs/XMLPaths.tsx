export default function XMLPaths() {
  return (
    <>
      {/* Main document body */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="#FF6600"
        stroke="none"
      />
      
      {/* Folded corner */}
      <path
        d="M23 4V12H29"
        fill="#FFB380"
        stroke="none"
      />
      
      {/* XML tags */}
      <g stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round">
        <path d="M10 18L12 20L10 22" />
        <path d="M26 18L24 20L26 22" />
      </g>
      
      {/* Forward slash / */}
      <path 
        d="M20 16L16 26" 
        stroke="white" 
        strokeWidth="1.5" 
        strokeLinecap="round"
      />
      
      {/* XML text label */}
      <text
        x="18"
        y="30"
        fontSize="5"
        fontWeight="700"
        textAnchor="middle"
        fill="white"
        fontFamily="Arial, sans-serif"
      >
        XML
      </text>
      
      {/* Document outline */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="none"
        stroke="#CC5200"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Corner fold line */}
      <path
        d="M23 4V12H29"
        fill="none"
        stroke="#CC5200"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}
