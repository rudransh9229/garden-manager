import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { Empty, PageHead, StatusPill } from '../components/ui.jsx';
import AttendancePanel from '../components/AttendancePanel.jsx';
import { addDays } from '../lib/dates.js';
import { fmtDate, plural } from '../lib/format.js';
import { MANAGER_EDIT_DAYS } from '../lib/constants.js';

const WINDOW = 7;

/** Phone-first: the events happening around today, with the crew list open under each one. */
export default function Attendance() {
  const { data, state, isOwner, today } = useStore();
  const [open, setOpen] = useState(() => new Set());

  const crewCount = new Map();
  for (const a of state.attendance) crewCount.set(a.bookingId, (crewCount.get(a.bookingId) || 0) + 1);

  const inWindow = data.rows
    .filter((r) => r.counted && r.booking.date >= addDays(today, -WINDOW) && r.booking.date <= addDays(today, WINDOW))
    .sort((a, b) => (a.booking.date < b.booking.date ? -1 : 1));
  const groups = [
    { title: 'Today', rows: inWindow.filter((r) => r.booking.date === today), openByDefault: true },
    { title: `Coming up (next ${WINDOW} days)`, rows: inWindow.filter((r) => r.booking.date > today) },
    { title: `Last ${WINDOW} days`, rows: inWindow.filter((r) => r.booking.date < today).reverse() },
  ].filter((g) => g.rows.length);

  const isOpen = (r, byDefault) => (open.has(r.id) ? !byDefault : !!byDefault);
  const toggle = (id) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <>
      <PageHead title="Attendance" sub={isOwner ? undefined : `You can change events from the last ${MANAGER_EDIT_DAYS} days.`} />
      {groups.length === 0 ? (
        <div className="card">
          <Empty title="No events around today" action={<Link className="btn" to="/events">Find an older event</Link>}>
            Events from the last {WINDOW} days and the next {WINDOW} days show up here.
          </Empty>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.title} style={{ marginBottom: 22 }}>
            <h2 style={{ marginBottom: 10 }}>{g.title}</h2>
            <div className="stack" style={{ gap: 12 }}>
              {g.rows.map((r) => {
                const shown = isOpen(r, g.openByDefault);
                const n = crewCount.get(r.id) || 0;
                return (
                  <div className="card" key={r.id}>
                    <div className="row between">
                      <div>
                        <div className="row" style={{ gap: 8 }}>
                          <b style={{ fontSize: 16 }}><Link to={`/events/${r.id}`}>{r.client.name}</Link></b>
                          <StatusPill status={r.booking.status} />
                        </div>
                        <div className="small muted">
                          {fmtDate(r.booking.date)} · {r.eventType}{r.booking.guests ? ` · ${r.booking.guests} guests` : ''} · {n ? plural(n, 'person', 'people') + ' added' : 'nobody added yet'}
                        </div>
                      </div>
                      <button className="btn small" aria-expanded={shown} onClick={() => toggle(r.id)}>{shown ? 'Hide' : 'Mark attendance'}</button>
                    </div>
                    {shown && (
                      <div style={{ marginTop: 12 }}>
                        <AttendancePanel row={r} canEdit={isOwner || r.booking.date >= addDays(today, -MANAGER_EDIT_DAYS)} showWages={isOwner} lockedMessage="Ask an owner to change this one." />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </>
  );
}
