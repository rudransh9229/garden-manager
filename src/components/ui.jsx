import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { searchRows } from '../lib/search.js';
import { fmtDate } from '../lib/format.js';

const P = {
  home: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  calendar: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4-4',
  file: 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 17h6',
  rupee: 'M7 5h10M7 9h10M7 5c5 0 7 1.5 7 4s-2 4-7 4l7 7',
  bars: 'M5 20V10M12 20V4M19 20v-7',
  pie: 'M12 3v9h9a9 9 0 1 1-9-9zM15 3.5A9 9 0 0 1 20.5 9H15z',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18.5 14a6.5 6.5 0 0 1 3 6',
  check: 'M4 12.5 9 17.5 20 6.5M4 4h16v16H4z',
  upload: 'M12 16V4m0 0L7 9m5-5 5 5M4 17v3h16v-3',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.3 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  key: 'M14.5 9.5a4 4 0 1 0-3.9 3.9L4 20v-3h3v-3h3l1.1-1.1M16 8h.01',
  plus: 'M12 5v14M5 12h14',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  scale: 'M12 4v16M7 20h10M4 8h16M4 8l-2.5 6a3 3 0 0 0 5 0zM20 8l-2.5 6a3 3 0 0 0 5 0z',
};
export function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const prev = document.activeElement;
    const el = ref.current;
    const first = el?.querySelector('input:not([type=hidden]), select, textarea, button.primary');
    (first || el)?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1} style={wide ? { width: 'min(820px,100%)' } : undefined}>
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ title, children, confirmLabel = 'Confirm', danger, onConfirm, onClose }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Keep it</button>
          <button className={`btn ${danger ? 'danger solid' : 'primary'}`} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
        </>
      }
    >
      <div className="stack" style={{ gap: 10 }}>{children}</div>
    </Modal>
  );
}

export function Field({ label, hint, error, children, full }) {
  const id = useId();
  const child = React.isValidElement(children) ? React.cloneElement(children, { id, 'aria-invalid': error ? true : undefined }) : children;
  return (
    <div className={`field${full ? ' full' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {child}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="err" role="alert">{error}</span>}
    </div>
  );
}

export function MoneyInput(props) {
  return (
    <div className="money-input">
      <span>₹</span>
      <input type="text" inputMode="numeric" autoComplete="off" {...props} />
    </div>
  );
}

export const StatusPill = ({ status }) => <span className={`pill ${status}`}>{status}</span>;

export function Kpi({ label, value, sub, accent, tone }) {
  return (
    <div className={`card kpi${accent ? ' accent' : ''}`}>
      <div className="label">{label}</div>
      <div className={`value${tone ? ` ${tone}` : ''}`}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function PageHead({ title, sub, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function SortTh({ label, k, sort, setSort, right }) {
  const on = sort.key === k;
  return (
    <th className={right ? 'right' : ''} aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => setSort({ key: k, dir: on && sort.dir === 'desc' ? 'asc' : 'desc' })}>
        {label}
        <span aria-hidden="true">{on ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  );
}
export function sortRows(rows, sort, getters) {
  const g = getters[sort.key];
  const out = [...rows].sort((a, b) => {
    const x = g(a), y = g(b);
    return x < y ? -1 : x > y ? 1 : 0;
  });
  return sort.dir === 'asc' ? out : out.reverse();
}

/** Type a name or date, click the event. Used wherever an invoice or payment has to be tied to an event. */
export function EventPicker({ rows, value, onChange, extra, label = 'Event', showMoney = false }) {
  const [q, setQ] = useState('');
  const chosen = rows.find((r) => r.id === value);
  const results = useMemo(() => (q.trim() ? searchRows(rows, q, extra).slice(0, 8) : []), [rows, q, extra]);
  if (chosen) {
    return (
      <div className="field">
        <span className="lab">{label}</span>
        <div className="row between card" style={{ padding: '10px 12px', boxShadow: 'none' }}>
          <div>
            <div className="t" style={{ fontWeight: 500 }}>{chosen.client.name}</div>
            <div className="small muted">{fmtDate(chosen.booking.date)} · {chosen.eventType}</div>
          </div>
          <button type="button" className="btn small" onClick={() => onChange('')}>Change</button>
        </div>
      </div>
    );
  }
  return (
    <div className="field">
      <label htmlFor="event-picker">{label}</label>
      <input id="event-picker" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type the client name or the event date" autoComplete="off" />
      {q.trim() && (
        <div className="picker-list" role="listbox">
          {results.length === 0 && <div className="small muted" style={{ padding: 12 }}>No event found. Check the spelling, or try the date like 4 Nov 2023.</div>}
          {results.map((r) => (
            <button key={r.id} type="button" role="option" aria-selected="false" onClick={() => onChange(r.id)}>
              <span style={{ flex: 1 }}>
                <b style={{ fontWeight: 500 }}>{r.client.name}</b>
                <span className="small muted"> · {r.eventType}</span>
              </span>
              <span className="small muted">{fmtDate(r.booking.date)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
