import React from 'react';

// The mark: six marigold petals in a pinwheel on a green tile, drawn as shapes so it looks the same everywhere.
export default function Logo({ size = 36, flat = false }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} role="img" aria-label="Garden Manager" style={{ flex: 'none', display: 'block' }}>
      <defs>
        <linearGradient id="pwbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#23704e" /><stop offset="1" stopColor="#0b261c" /></linearGradient>
        <radialGradient id="pwglow" cx="0.3" cy="0.2" r="0.8"><stop offset="0" stopColor="#fff" stopOpacity="0.22" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill={flat ? '#134431' : 'url(#pwbg)'} />
      {!flat && <rect width="512" height="512" rx="112" fill="url(#pwglow)" />}
      <g className="pw-petals" dangerouslySetInnerHTML={{ __html: PETALS }} />
    </svg>
  );
}

const PETALS = '<g transform="rotate(0 256 256)"><path class="pw-p" style="--i:0" d="M256 256C236 150 300 70 372 112C420 142 392 214 340 238C310 252 280 256 256 256Z" fill="#FFD54A"/></g><g transform="rotate(60 256 256)"><path class="pw-p" style="--i:1" d="M256 256C236 150 300 70 372 112C420 142 392 214 340 238C310 252 280 256 256 256Z" fill="#FFB02E"/></g><g transform="rotate(120 256 256)"><path class="pw-p" style="--i:2" d="M256 256C236 150 300 70 372 112C420 142 392 214 340 238C310 252 280 256 256 256Z" fill="#FF8A1F"/></g><g transform="rotate(180 256 256)"><path class="pw-p" style="--i:3" d="M256 256C236 150 300 70 372 112C420 142 392 214 340 238C310 252 280 256 256 256Z" fill="#FF6B4A"/></g><g transform="rotate(240 256 256)"><path class="pw-p" style="--i:4" d="M256 256C236 150 300 70 372 112C420 142 392 214 340 238C310 252 280 256 256 256Z" fill="#F0488B"/></g><g transform="rotate(300 256 256)"><path class="pw-p" style="--i:5" d="M256 256C236 150 300 70 372 112C420 142 392 214 340 238C310 252 280 256 256 256Z" fill="#FFC23D"/></g><circle class="pw-hub" cx="256" cy="256" r="30" fill="#134431"/>';
