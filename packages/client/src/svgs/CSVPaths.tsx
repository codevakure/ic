export default function CSVPaths() {
  return (
    <>
      {/* Main CSV document body */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="#16A34A"
        stroke="none"
      />
      
      {/* Folded corner */}
      <path
        d="M23 4V12H29"
        fill="#BBF7D0"
        stroke="none"
      />
      
      {/* CSV table grid */}
      <g stroke="white" strokeWidth="1" fill="none">
        <line x1="12" y1="16" x2="12" y2="26" />
        <line x1="18" y1="16" x2="18" y2="26" />
        <line x1="24" y1="16" x2="24" y2="26" />
        <line x1="10" y1="18" x2="26" y2="18" />
        <line x1="10" y1="21" x2="26" y2="21" />
        <line x1="10" y1="24" x2="26" y2="24" />
      </g>
      
      {/* CSV text */}
      <text
        x="18"
        y="29"
        fontSize="6"
        fontWeight="700"
        textAnchor="middle"
        fill="white"
        fontFamily="Arial, sans-serif"
      >
        CSV
      </text>
      
      {/* Document outline */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="none"
        stroke="#15803D"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Corner fold line */}
      <path
        d="M23 4V12H29"
        fill="none"
        stroke="#15803D"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}
