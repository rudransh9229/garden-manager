import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { ATT_FACTOR, ATT_LABEL, ATTENDANCE_STATES } from '../lib/constants.js';
import { inr } from '../lib/format.js';

/**
 * Who worked on this event and whether they came.
 * showWages: owners see the wage for each person and the labour cost; the manager never does.
 */
export default function AttendancePanel({ row, canEdit, showWages, lockedMessage }) {
  const { state, dispatch, role } = useStore();
  const [pick, setPick] = useState('');
  const crew = state.attendance
    .filter((a) => a.bookingId === row.id)
    .map((a) => ({ ...a, person: state.staff.find((s) => s.id === a.staffId) }))
    .filter((a) => a.person)
    .sort((a, b) => a.person.name.localeCompare(b.person.name));
  const taken = new Set(crew.map((c) => c.staffId));
  const available = state.staff.filter((s) => s.active && !taken.has(s.id)).sort((a, b) => a.name.localeCompare(b.name));
  const days = crew.reduce((s, c) => s + ATT_FACTOR[c.status], 0);

  const mark = (staffId, status) => dispatch({ type: 'setAttendance', bookingId: row.id, staffId, status, by: role });
  const add = () => {
    if (!pick) return;
    mark(pick, 'present');
    setPick('');
  };

  return (
    <div>
      {crew.length === 0 && <p className="muted" style={{ padding: '6px 0 10px' }}>Nobody added yet. Pick the people working this event below.</p>}
      {crew.map((c) => (
        <div className="att-row" key={c.staffId}>
          <div className="who">
            <div style={{ fontWeight: 500 }}>{c.person.name}</div>
            <div className="small muted">{c.person.role}{showWages ? ` · ${inr(c.person.dailyWage)} a day` : ''}</div>
          </div>
          {canEdit ? (
            <div className="seg" role="group" aria-label={`Attendance for ${c.person.name}`}>
              {ATTENDANCE_STATES.map((s) => (
                <button key={s} className={s} aria-pressed={c.status === s} onClick={() => mark(c.staffId, s)}>{ATT_LABEL[s]}</button>
              ))}
            </div>
          ) : (
            <span className={`pill ${c.status === 'present' ? 'Confirmed' : c.status === 'half' ? 'Tentative' : 'Cancelled'}`}>{ATT_LABEL[c.status]}</span>
          )}
          {showWages && <b className="num" style={{ minWidth: 70, textAlign: 'right' }}>{inr(c.wageApplied || 0)}</b>}
          {canEdit && <button className="btn small danger" onClick={() => dispatch({ type: 'removeAttendance', bookingId: row.id, staffId: c.staffId })} aria-label={`Remove ${c.person.name}`}>Remove</button>}
        </div>
      ))}
      {crew.length > 0 && (
        <p className="small muted" style={{ marginTop: 8 }}>
          {crew.length} {crew.length === 1 ? 'person' : 'people'} · {days} {days === 1 ? 'day' : 'days'} worked
          {showWages && <> · labour cost <b>{inr(row.labour)}</b></>}
        </p>
      )}
      {canEdit ? (
        <div className="row" style={{ marginTop: 12 }}>
          <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Add a staff member" style={{ maxWidth: 280 }}>
            <option value="">{available.length ? 'Add a staff member…' : state.staff.length ? 'Everyone is added' : 'No staff yet. Add people on the Staff page.'}</option>
            {available.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
          </select>
          <button className="btn" onClick={add} disabled={!pick}>Add</button>
        </div>
      ) : (
        lockedMessage && <div className="note info" style={{ marginTop: 12 }}>{lockedMessage}</div>
      )}
    </div>
  );
}
