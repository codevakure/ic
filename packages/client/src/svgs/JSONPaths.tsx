export default function JSONPaths() {
  return (
    <>
      {/* Main document body */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="#5C5C5C"
        stroke="none"
      />
      
      {/* Folded corner */}
      <path
        d="M23 4V12H29"
        fill="#9E9E9E"
        stroke="none"
      />
      
      {/* JSON braces */}
      <g fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
        {/* Left brace { */}
        <path d="M13 15C12 15 11 16 11 17V19C11 20 10 21 10 21C10 21 11 22 11 23V25C11 26 12 27 13 27" />
        {/* Right brace } */}
        <path d="M23 15C24 15 25 16 25 17V19C25 20 26 21 26 21C26 21 25 22 25 23V25C25 26 24 27 23 27" />
      </g>
      
      {/* Dots for JSON content */}
      <g fill="#FBBF24">
        <circle cx="15" cy="19" r="1" />
        <circle cx="18" cy="21" r="1" />
        <circle cx="21" cy="23" r="1" />
      </g>
      
      {/* Document outline */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="none"
        stroke="#404040"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Corner fold line */}
      <path
        d="M23 4V12H29"
        fill="none"
        stroke="#404040"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}
