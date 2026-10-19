import React from 'react';

/** Full-screen loading animation: a growing leaf ring and three dots. Replaces the plain "Loading…" texts. */
export default function Splash({ label = 'Opening your garden' }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <div className="splash-ring" aria-hidden="true">
        <svg viewBox="0 0 48 48" width="34" height="34"><path d="M10 38C10 20 22 10 38 10c0 16-10 28-28 28Z" fill="currentColor" /><path d="M10 38 28 20" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" /></svg>
      </div>
      <div className="splash-name">Garden Manager</div>
      <div className="splash-label">{label}<span className="splash-dots" aria-hidden="true"><i /><i /><i /></span></div>
    </div>
  );
}
