export default function ZipPaths() {
  return (
    <>
      {/* Main ZIP archive body */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="#FF8C00"
        stroke="none"
      />
      
      {/* Folded corner */}
      <path
        d="M23 4V12H29"
        fill="#FFE4B5"
        stroke="none"
      />
      
      {/* Zipper pattern */}
      <g fill="white">
        <rect x="16" y="16" width="4" height="1.5" />
        <rect x="16" y="18" width="4" height="1.5" />
        <rect x="16" y="20" width="4" height="1.5" />
        <rect x="16" y="22" width="4" height="1.5" />
        <rect x="16" y="24" width="4" height="1.5" />
      </g>
      
      {/* Zipper pull */}
      <circle cx="18" cy="27" r="1.5" fill="#FFB84D" stroke="white" strokeWidth="1"/>
      
      {/* Document outline */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="none"
        stroke="#E67E00"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Corner fold line */}
      <path
        d="M23 4V12H29"
        fill="none"
        stroke="#E67E00"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}
