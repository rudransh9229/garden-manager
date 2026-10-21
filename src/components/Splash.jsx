import React from 'react';
import Logo from './Logo.jsx';

/** Full-screen loading animation: a growing leaf ring and three dots. Replaces the plain "Loading…" texts. */
export default function Splash({ label = 'Opening your garden' }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <div className="splash-ring" aria-hidden="true">
        <Logo size={92} />
      </div>
      <div className="splash-name">Garden Manager</div>
      <div className="splash-label">{label}<span className="splash-dots" aria-hidden="true"><i /><i /><i /></span></div>
    </div>
  );
}
