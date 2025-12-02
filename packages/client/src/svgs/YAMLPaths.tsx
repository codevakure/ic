export default function YAMLPaths() {
  return (
    <>
      {/* Main document body */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="#CB171E"
        stroke="none"
      />
      
      {/* Folded corner */}
      <path
        d="M23 4V12H29"
        fill="#F47A7D"
        stroke="none"
      />
      
      {/* YAML structure lines */}
      <g fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
        <line x1="10" y1="16" x2="16" y2="16" />
        <line x1="12" y1="19" x2="20" y2="19" />
        <line x1="12" y1="22" x2="18" y2="22" />
        <line x1="14" y1="25" x2="24" y2="25" />
      </g>
      
      {/* Key-value dots */}
      <g fill="#FBBF24">
        <circle cx="17" cy="16" r="1" />
        <circle cx="21" cy="19" r="1" />
        <circle cx="19" cy="22" r="1" />
        <circle cx="25" cy="25" r="1" />
      </g>
      
      {/* Document outline */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="none"
        stroke="#9A0F14"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Corner fold line */}
      <path
        d="M23 4V12H29"
        fill="none"
        stroke="#9A0F14"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}
