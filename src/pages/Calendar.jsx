import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { useUi } from '../uiContext.jsx';
import { Icon, PageHead, StatusPill, TypeTag } from '../components/ui.jsx';
import { daysInMonth, isoFrom, parseISO, weekday } from '../lib/dates.js';
import { fmtDate, inr, MONTHS, MONTHS_LONG, plural, WEEKDAYS } from '../lib/format.js';

const SHOWN = ['Confirmed', 'Tentative', 'Enquiry', 'Completed'];

export default function Calendar() {
  const { data, isOwner, today } = useStore();
  const ui = useUi();
  const t = parseISO(today);
  const [cur, setCur] = useState({ y: t.y, m: t.m });
  const [sel, setSel] = useState(today);
  const [view, setViewState] = useState(() => { try { return localStorage.getItem('garden-cal-view') === 'grid' ? 'grid' : 'list'; } catch { return 'list'; } });
  const setView = (v) => { setViewState(v); try { localStorage.setItem('garden-cal-view', v); } catch { /* not saved, still works */ } };

  const byDate = useMemo(() => {
    const m = new Map();
    for (const r of data.rows) {
      if (r.booking.status === 'Cancelled') continue; // a cancelled booking frees its date
      if (!m.has(r.booking.date)) m.set(r.booking.date, []);
      m.get(r.booking.date).push(r);
    }
    return m;
  }, [data.rows]);

  const first = isoFrom(cur.y, cur.m, 1);
  const lead = weekday(first);
  const dim = daysInMonth(cur.y, cur.m);
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(isoFrom(cur.y, cur.m, d));
  while (cells.length % 7) cells.push(null);

  const go = (delta) => setCur((c) => { const n = c.y * 12 + (c.m - 1) + delta; return { y: Math.floor(n / 12), m: (n % 12) + 1 }; });
  const monthCount = [...byDate.entries()].filter(([d]) => d.startsWith(`${cur.y}-${String(cur.m).padStart(2, '0')}`)).reduce((s, [, l]) => s + l.length, 0);
  const years = [];
  for (let y = t.y - 7; y <= t.y + 3; y++) years.push(y);
  const day = byDate.get(sel) || [];
  const prefix = `${cur.y}-${String(cur.m).padStart(2, '0')}`;
  const booked = [...byDate.entries()].filter(([d]) => d.startsWith(prefix)).sort(([a], [b]) => (a < b ? -1 : 1));

  return (
    <div className="page">
      <PageHead title="Calendar">
        {isOwner && <button className="btn primary" onClick={() => ui.newBooking(sel)}><Icon name="plus" />New booking</button>}
      </PageHead>

      <div className="cal-head">
        <button className="btn" onClick={() => go(-1)} aria-label="Previous month">←</button>
        <button className="btn" onClick={() => go(1)} aria-label="Next month">→</button>
        <h2>{MONTHS_LONG[cur.m - 1]} {cur.y}</h2>
        <select value={cur.m} onChange={(e) => setCur({ ...cur, m: Number(e.target.value) })} aria-label="Month" style={{ width: 'auto' }}>
          {MONTHS_LONG.map((mn, i) => <option key={mn} value={i + 1}>{mn}</option>)}
        </select>
        <select value={cur.y} onChange={(e) => setCur({ ...cur, y: Number(e.target.value) })} aria-label="Year" style={{ width: 'auto' }}>
          {years.map((y) => <option key={y}>{y}</option>)}
        </select>
        <button className="btn" onClick={() => { setCur({ y: t.y, m: t.m }); setSel(today); }}>Today</button>
        <span className="muted small cal-count" style={{ marginLeft: 'auto' }}>{plural(monthCount, 'event')} this month</span>
        <div className="seg" role="group" aria-label="How to show the month">
          <button aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
          <button aria-pressed={view === 'grid'} onClick={() => setView('grid')}>Calendar</button>
        </div>
      </div>

      {view === 'list' && (
        <section className="card booked" aria-label={`Booked dates in ${MONTHS_LONG[cur.m - 1]} ${cur.y}`}>
          {booked.length === 0 ? (
            <p className="muted">Nothing booked in {MONTHS_LONG[cur.m - 1]} {cur.y}.</p>
          ) : (
            <div className="list">
              {booked.flatMap(([iso, list]) => list.map((r, i) => (
                <div className={`list-row booked-row${iso === today ? ' today' : ''}${iso < today ? ' past' : ''}`} key={r.id}>
                  <div className="booked-date" aria-label={fmtDate(iso)}>
                    {i === 0 ? (<><b>{Number(iso.slice(8))}</b><span>{WEEKDAYS[weekday(iso)]} {MONTHS[cur.m - 1]}</span></>) : null}
                  </div>
                  <div className="grow">
                    <div className="t"><Link to={`/events/${r.id}`}>{r.client.name}</Link></div>
                    <div className="small muted"><TypeTag name={r.eventType} />{r.booking.guests ? ` · ${r.booking.guests} guests` : ''}{isOwner && r.counted ? ` · ${r.pending > 0 ? `${inr(r.pending)} due` : 'fully paid'}` : ''}</div>
                  </div>
                  <StatusPill status={r.booking.status} />
                </div>
              )))}
            </div>
          )}
        </section>
      )}

      {view === 'grid' && (<>
      <div className="cal" role="grid" aria-label={`${MONTHS_LONG[cur.m - 1]} ${cur.y}`}>
        {WEEKDAYS.map((w) => <div className="dow" key={w} role="columnheader">{w}</div>)}
        {cells.map((iso, i) => {
          if (!iso) return <div className="day out" key={`o${i}`} aria-hidden="true" />;
          const list = byDate.get(iso) || [];
          const d = Number(iso.slice(8));
          return (
            <button
              key={iso}
              role="gridcell"
              className={`day${iso === today ? ' today' : ''}${iso === sel ? ' sel' : ''}`}
              onClick={() => setSel(iso)}
              aria-label={`${fmtDate(iso)}, ${list.length ? plural(list.length, 'event') : 'free'}`}
              aria-selected={iso === sel}
            >
              <span className="dn">{d}</span>
              {list.slice(0, 2).map((r) => <span key={r.id} className={`ev ${r.booking.status}`}>{r.client.name.split(' ')[0]} · {r.eventType}</span>)}
              {list.length > 2 && <span className="more">+{list.length - 2} more</span>}
              {list.length > 0 && <span className="dots">{list.map((r) => <i key={r.id} />)}</span>}
            </button>
          );
        })}
      </div>

      <div className="legend" style={{ marginTop: 12 }}>
        {SHOWN.map((s) => <span key={s}><i className="sw" style={{ background: `var(--cal-${s}, ${{ Confirmed: '#2f8a5a', Completed: '#6b776f', Tentative: '#e3a21a', Enquiry: '#6f93b3' }[s]})` }} />{s}</span>)}
        <span className="faint">Cancelled bookings are not shown. Their date is free.</span>
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-head">
          <h2>{fmtDate(sel)}</h2>
          {isOwner && <button className="btn small" onClick={() => ui.newBooking(sel)}>Add a booking on this day</button>}
        </div>
        {day.length === 0 ? (
          <p className="muted">Nothing booked. This date is free.</p>
        ) : (
          <div className="list">
            {day.map((r) => (
              <div className="list-row" key={r.id}>
                <div className="grow">
                  <div className="t"><Link to={`/events/${r.id}`}>{r.client.name}</Link></div>
                  <div className="small muted">{r.eventType}{r.booking.guests ? ` · ${r.booking.guests} guests` : ''}{isOwner && r.counted ? ` · ${r.pending > 0 ? `${inr(r.pending)} due` : 'fully paid'}` : ''}</div>
                </div>
                <StatusPill status={r.booking.status} />
              </div>
            ))}
          </div>
        )}
      </section>
      </>)}
    </div>
  );
}
