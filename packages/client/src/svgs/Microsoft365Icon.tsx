import React from 'react';

export default function Microsoft365Icon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      className={className}
    >
      <rect x="2" y="2" width="12" height="12" fill="#EA3E23" />
      <rect x="18" y="2" width="12" height="12" fill="#00A4EF" />
      <rect x="2" y="18" width="12" height="12" fill="#7FBA00" />
      <rect x="18" y="18" width="12" height="12" fill="#FFB900" />
    </svg>
  );
}
