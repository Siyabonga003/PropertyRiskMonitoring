import React from 'react';

interface Props {
  className?: string;
}

/** Shield with a sensor-signal glyph. Matches /public/favicon.svg. */
export const BrandMark: React.FC<Props> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 64 64" className={className} role="img" aria-label="RiskGuard">
    <rect width="64" height="64" rx="14" fill="#12214A" />
    <path
      d="M32 9 12.5 16.6v13.7c0 12.2 8.1 20.6 19.5 24.7 11.4-4.1 19.5-12.5 19.5-24.7V16.6L32 9Z"
      fill="#0B1633"
      stroke="#FFFFFF"
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <path d="M23.8 29.2a11.6 11.6 0 0 1 16.4 0" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
    <path d="M27.6 33.8a6.2 6.2 0 0 1 8.8 0" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
    <circle cx="32" cy="40" r="3.6" fill="#FF2E88" />
  </svg>
);
