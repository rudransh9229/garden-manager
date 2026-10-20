import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { useUi } from '../uiContext.jsx';
import { Empty, Icon, PageHead, StatusPill, TypeTag } from '../components/ui.jsx';
import { describeQuery, parseQuery, searchRows } from '../lib/search.js';
import { fmtDate, fmtPhone, inr, plural } from '../lib/format.js';
import { STATUSES } from '../lib/constants.js';

const PAGE = 40;
const EXAMPLES = ['Sharma', '4 Nov 2023', 'Nov 2023', '2022', '25 Dec', 'INV-2023-014'];

export default function Events() {
  const { data, state, isOwner } = useStore();
  const ui = useUi();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const [year, setYear] = useState('all');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [limit, setLimit] = useState(PAGE);

  const setQ = (v) => { setLimit(PAGE); setParams(v ? { q: v } : {}, { replace: true }); };
  const extra = useMemo(() => {
    const m = new Map();
    for (const d of state.documents) m.set(d.bookingId, `${m.get(d.bookingId) || ''} ${d.number || ''}`);
    return m;
  }, [state.documents]);

  const years = useMemo(() => [...new Set(data.rows.map((r) => r.year))].sort((a, b) => b - a), [data.rows]);
  const typesInUse = useMemo(() => [...new Set([...state.settings.eventTypes, ...data.rows.map((r) => r.eventType)])], [state.settings.eventTypes, data.rows]);
  const found = useMemo(() => searchRows(data.rows, q, extra), [data.rows, q, extra]);
  const rows = useMemo(
    () => found.filter((r) => (year === 'all' || r.year === Number(year)) && (type === 'all' || r.eventType === type) && (status === 'all' || r.booking.status === status)),
    [found, year, type, status],
  );
  const understood = describeQuery(parseQuery(q));
  const filtering = year !== 'all' || type !== 'all' || status !== 'all';

  return (
    <div className="page">
      <PageHead title="Events" sub="Every booking since the garden opened. Type a client name or a date to find an old event.">
        {isOwner && <button className="btn primary" onClick={() => ui.newBooking()}><Icon name="plus" />New booking</button>}
      </PageHead>

      <div className="search-big">
        <Icon name="search" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Client name, phone or date" aria-label="Search events" autoFocus />
      </div>
      <div className="search-examples">
        <span>Try:</span>
        {EXAMPLES.map((ex) => <button key={ex} onClick={() => setQ(ex)}>{ex}</button>)}
      </div>

      <div className="row" style={{ margin: '18px 0 12px' }}>
        <select value={year} onChange={(e) => { setYear(e.target.value); setLimit(PAGE); }} aria-label="Year" style={{ width: 'auto' }}>
          <option value="all">All years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={type} onChange={(e) => { setType(e.target.value); setLimit(PAGE); }} aria-label="Booking type" style={{ width: 'auto' }}>
          <option value="all">All booking types</option>
          {typesInUse.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setLimit(PAGE); }} aria-label="Status" style={{ width: 'auto' }}>
          <option value="all">Every status</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        {(filtering || q) && <button className="btn link" onClick={() => { setYear('all'); setType('all'); setStatus('all'); setQ(''); }}>Clear</button>}
        <span className="muted small" style={{ marginLeft: 'auto' }} aria-live="polite">
          {plural(rows.length, 'event')}{understood ? ` · ${understood}` : ''}
        </span>
      </div>

      <div className="card" style={{ padding: 8 }}>
        {rows.length === 0 ? (
          <Empty
            title={data.rows.length === 0 ? 'No events yet' : 'No events found'}
            action={data.rows.length === 0 && isOwner ? <button className="btn primary" onClick={() => ui.newBooking()}>Add the first booking</button> : null}
          >
            {data.rows.length === 0
              ? 'Add a booking, or bring in your old records from the Import page.'
              : q
                ? 'Check the spelling, or try just the first name. For a date, type it like 4 Nov 2023 or 04/11/2023.'
                : 'No event matches these filters. Clear them to see everything.'}
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="events-sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Client</th>
                  <th className="hide-sm">Type</th>
                  <th>Status</th>
                  {isOwner && <th className="right">Price</th>}
                  {isOwner && <th className="right hide-sm">Balance due</th>}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((r) => (
                  <tr key={r.id} className="click" tabIndex={0} onClick={() => nav(`/events/${r.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/events/${r.id}`)}>
                    <td className="num e-date" style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.booking.date)}</td>
                    <td className="e-who">
                      <div style={{ fontWeight: 500 }}>{r.client.name}</div>
                      <div className="small muted">{[fmtPhone(r.client.phone), r.client.address].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="hide-sm e-type"><TypeTag name={r.eventType} /></td>
                    <td className="e-stat"><StatusPill status={r.booking.status} /></td>
                    {isOwner && (
                      <td className="right num e-amt">
                        {r.booking.status === 'Cancelled' ? <span className="muted">{r.cancellation ? `Kept ${inr(r.cancellation.advanceKept)}` : '—'}</span> : inr(r.booking.total)}
                      </td>
                    )}
                    {isOwner && (
                      <td className="right num hide-sm e-bal">{r.counted ? (r.pending > 0 ? inr(r.pending) : <span className="faint">Paid</span>) : <span className="faint">—</span>}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > limit && (
          <div style={{ textAlign: 'center', padding: 12 }}>
            <button className="btn" onClick={() => setLimit((l) => l + PAGE)}>Show {Math.min(PAGE, rows.length - limit)} more</button>
          </div>
        )}
      </div>
    </div>
  );
}
