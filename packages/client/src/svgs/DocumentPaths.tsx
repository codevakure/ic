export default function DocumentPaths() {
  return (
    <>
      {/* Main document body - scaled to 36x36 viewBox */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="#4285F4"
        stroke="none"
      />
      
      {/* Folded corner */}
      <path
        d="M23 4V12H29"
        fill="#E8F0FE"
        stroke="none"
      />
      
      {/* Document lines */}
      <path
        d="M11 16H25"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M11 20H25"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M11 24H21"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      
      {/* Document outline */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="none"
        stroke="#1A73E8"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Corner fold line */}
      <path
        d="M23 4V12H29"
        fill="none"
        stroke="#1A73E8"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}
