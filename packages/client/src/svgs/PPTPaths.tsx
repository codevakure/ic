export default function PPTPaths() {
  return (
    <>
      {/* Main presentation document body */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="#FF6D01"
        stroke="none"
      />
      
      {/* Folded corner */}
      <path
        d="M23 4V12H29"
        fill="#FFE4CC"
        stroke="none"
      />
      
      {/* Presentation slide elements */}
      <rect
        x="11"
        y="16"
        width="14"
        height="8"
        rx="1"
        fill="white"
        stroke="none"
      />
      
      {/* Slide content lines */}
      <path
        d="M13 18H23"
        stroke="#FF6D01"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M13 21H19"
        stroke="#FF6D01"
        strokeWidth="1"
        strokeLinecap="round"
      />
      
      {/* Document outline */}
      <path
        d="M8 4C7.44772 4 7 4.44772 7 5V31C7 31.5523 7.44772 32 8 32H28C28.5523 32 29 31.5523 29 31V12L23 4H8Z"
        fill="none"
        stroke="#E55100"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Corner fold line */}
      <path
        d="M23 4V12H29"
        fill="none"
        stroke="#E55100"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}
