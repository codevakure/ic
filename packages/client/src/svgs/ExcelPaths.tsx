export default function ExcelPaths() {
  return (
    <>
      {/* Main Excel document body */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="#0F7B0F"
        stroke="none"
      />
      
      {/* Folded corner */}
      <path
        d="M23 4V12H29"
        fill="#A7F3D0"
        stroke="none"
      />
      
      {/* Excel grid */}
      <g stroke="white" strokeWidth="1" fill="none">
        <line x1="11" y1="16" x2="11" y2="26" />
        <line x1="15" y1="16" x2="15" y2="26" />
        <line x1="19" y1="16" x2="19" y2="26" />
        <line x1="23" y1="16" x2="23" y2="26" />
        <line x1="9" y1="18" x2="25" y2="18" />
        <line x1="9" y1="21" x2="25" y2="21" />
        <line x1="9" y1="24" x2="25" y2="24" />
      </g>
      
      {/* Excel X symbol */}
      <g stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round">
        <path d="M12 19L14 21M14 19L12 21" />
      </g>
      
      {/* Document outline */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="none"
        stroke="#065F46"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Corner fold line */}
      <path
        d="M23 4V12H29"
        fill="none"
        stroke="#065F46"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}
