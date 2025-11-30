export default function HTMLPaths() {
  return (
    <>
      {/* Main HTML document body */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="#E34F26"
        stroke="none"
      />
      
      {/* Folded corner */}
      <path
        d="M23 4V12H29"
        fill="#FFCCBC"
        stroke="none"
      />
      
      {/* HTML code brackets */}
      <g stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round">
        <path d="M12 18L10 20L12 22" />
        <path d="M24 18L26 20L24 22" />
        <line x1="21" y1="18" x2="15" y2="22" />
      </g>
      
      {/* HTML text */}
      <text
        x="18"
        y="28"
        fontSize="6"
        fontWeight="700"
        textAnchor="middle"
        fill="white"
        fontFamily="Arial, sans-serif"
      >
        HTML
      </text>
      
      {/* Document outline */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="none"
        stroke="#BF360C"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Corner fold line */}
      <path
        d="M23 4V12H29"
        fill="none"
        stroke="#BF360C"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}
