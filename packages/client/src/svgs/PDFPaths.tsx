export default function PDFPaths() {
  return (
    <>
      {/* Main PDF document body */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="#DC2626"
        stroke="none"
      />
      
      {/* Folded corner */}
      <path
        d="M23 4V12H29"
        fill="#FCA5A5"
        stroke="none"
      />
      
      {/* PDF text */}
      <text
        x="18"
        y="22"
        fontSize="8"
        fontWeight="700"
        textAnchor="middle"
        fill="white"
        fontFamily="Arial, sans-serif"
      >
        PDF
      </text>
      
      {/* Document outline */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="none"
        stroke="#B91C1C"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Corner fold line */}
      <path
        d="M23 4V12H29"
        fill="none"
        stroke="#B91C1C"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}
