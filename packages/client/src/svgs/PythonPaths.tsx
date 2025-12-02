export default function PythonPaths() {
  return (
    <>
      {/* Main document body */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="#3776AB"
        stroke="none"
      />
      
      {/* Folded corner */}
      <path
        d="M23 4V12H29"
        fill="#7EB8DA"
        stroke="none"
      />
      
      {/* Python logo - simplified snake */}
      <g fill="white">
        {/* Top snake */}
        <path d="M18 14C15.5 14 14 15.5 14 17V19H19V20H13V17C13 14.5 15 13 18 13C20 13 21 13.5 22 14.5L21 15.5C20.5 15 19.5 14 18 14Z" />
        {/* Bottom snake */}
        <path d="M18 26C20.5 26 22 24.5 22 23V21H17V20H23V23C23 25.5 21 27 18 27C16 27 15 26.5 14 25.5L15 24.5C15.5 25 16.5 26 18 26Z" />
        {/* Dots */}
        <circle cx="16" cy="16" r="1" />
        <circle cx="20" cy="24" r="1" />
      </g>
      
      {/* Document outline */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="none"
        stroke="#1E5A84"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Corner fold line */}
      <path
        d="M23 4V12H29"
        fill="none"
        stroke="#1E5A84"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}
