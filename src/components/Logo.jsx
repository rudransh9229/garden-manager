import React from 'react';

/** The garden gate with a flower inside it: the same mark as the app icon. */
export default function Logo({ size = 36, plain = false }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} role="img" aria-label="Garden Manager" style={{ flex: 'none', display: 'block' }}>
      {!plain && <rect width="512" height="512" rx="104" fill="#1f5a41" />}
      <path d="M158 386V236a98 98 0 0 1 196 0v150" fill="none" stroke="#E3A21A" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M112 386h288" stroke="#E3A21A" strokeWidth="28" strokeLinecap="round" />
      {[[256, 224], [278.5, 237], [278.5, 263], [256, 276], [233.5, 263], [233.5, 237]].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="19" fill="#FFFDF9" />)}
      <circle cx="256" cy="250" r="14" fill="#E3A21A" />
    </svg>
  );
}
