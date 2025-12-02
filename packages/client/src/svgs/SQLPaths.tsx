export default function SQLPaths() {
  return (
    <>
      {/* Main document body */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="#E48E00"
        stroke="none"
      />
      
      {/* Folded corner */}
      <path
        d="M23 4V12H29"
        fill="#FFD580"
        stroke="none"
      />
      
      {/* Database cylinder icon */}
      <g fill="white">
        <ellipse cx="18" cy="16" rx="5" ry="2" />
        <path d="M13 16V24C13 25.1 15.2 26 18 26C20.8 26 23 25.1 23 24V16" fill="none" stroke="white" strokeWidth="1.5" />
        <ellipse cx="18" cy="24" rx="5" ry="2" fill="none" stroke="white" strokeWidth="1.5" />
        <path d="M13 20C13 21.1 15.2 22 18 22C20.8 22 23 21.1 23 20" fill="none" stroke="white" strokeWidth="1" />
      </g>
      
      {/* Document outline */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="none"
        stroke="#B87000"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Corner fold line */}
      <path
        d="M23 4V12H29"
        fill="none"
        stroke="#B87000"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}
