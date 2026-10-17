import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Kpi } from './ui.jsx';
import { fmtDate, fmtPct, inr, inrShort, plural } from '../lib/format.js';

/** One filter row above all the charts on a page. Every chart on the page follows it. */
export function AnalyticsFilters({ f, setF, years, settings, types, yearNote }) {
  const set = (k) => (e) => setF({ ...f, [k]: k === 'year' && e.target.value !== 'all' ? Number(e.target.value) : e.target.value });
  return (
    <div className="card" style={{ padding: '12px 16px', marginBottom: 16 }}>
      <div className="row">
        <label className="small muted" htmlFor="f-year">Year</label>
        <select id="f-year" value={f.year} onChange={set('year')} style={{ width: 'auto' }}>
          <option value="all">All years</option>
          {[...years].reverse().map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <label className="small muted" htmlFor="f-season">Season</label>
        <select id="f-season" value={f.season} onChange={set('season')} style={{ width: 'auto' }}>
          <option value="all">All seasons</option>
          {settings.seasons.map((s) => <option key={s.name}>{s.name}</option>)}
        </select>
        <label className="small muted" htmlFor="f-type">Booking type</label>
        <select id="f-type" value={f.type} onChange={set('type')} style={{ width: 'auto' }}>
          <option value="all">All types</option>
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
        <label className="row small" style={{ gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={f.includeCancel} onChange={(e) => setF({ ...f, includeCancel: e.target.checked })} />
          Include kept advances from cancelled bookings
        </label>
      </div>
      {yearNote && <p className="small faint" style={{ marginTop: 8 }}>{yearNote}</p>}
    </div>
  );
}

export function Highlights({ items }) {
  return (
    <div className="highlights" style={{ marginBottom: 16 }}>
      {items.map((it) => <Kpi key={it.label} label={it.label} value={it.value} sub={it.sub} tone={it.tone} />)}
    </div>
  );
}

/** The events behind the bar or slice the person clicked. */
export function DrillPanel({ drill, onClose, mode = 'revenue' }) {
  const ref = useRef(null);
  useEffect(() => { if (drill) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [drill]);
  if (!drill) return null;
  const rows = [...drill.rows].sort((a, b) => (a.booking.date < b.booking.date ? -1 : 1));
  const cancel = drill.cancel || [];
  return (
    <section className="card" ref={ref} aria-live="polite" style={{ marginTop: 16, borderColor: 'var(--green)' }}>
      <div className="card-head">
        <div>
          <h2>{drill.title}</h2>
          <p>{plural(rows.length, 'event')}{cancel.length ? ` and ${plural(cancel.length, 'kept advance')}` : ''}</p>
        </div>
        <button className="btn small" onClick={onClose}>Close</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Date</th><th>Client</th><th className="hide-sm">Type</th><th className="right">{mode === 'expenses' ? 'Expenses' : 'Revenue'}</th></tr>
          </thead>
          <tbody>
            {rows.slice(0, 60).map((r) => (
              <tr key={r.id}>
                <td className="num" style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.booking.date)}</td>
                <td><Link to={`/events/${r.id}`}>{r.client.name}</Link></td>
                <td className="hide-sm">{r.eventType}</td>
                <td className="right num">{inr(mode === 'expenses' ? r.expenses : r.revenue)}</td>
              </tr>
            ))}
            {mode !== 'expenses' && cancel.map((c) => (
              <tr key={`c${c.bookingId}`}>
                <td className="num" style={{ whiteSpace: 'nowrap' }}>{fmtDate(c.date)}</td>
                <td><Link to={`/events/${c.bookingId}`}>{c.client.name}</Link> <span className="pill Cancelled">Cancelled</span></td>
                <td className="hide-sm">Kept advance</td>
                <td className="right num">{inr(c.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 60 && <p className="small muted" style={{ marginTop: 8 }}>Showing the first 60 of {rows.length}.</p>}
    </section>
  );
}

export { fmtPct, inrShort };
