import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { Empty, Field, Icon, Modal, MoneyInput, PageHead } from '../components/ui.jsx';
import { ATT_FACTOR, STAFF_ROLES } from '../lib/constants.js';
import { MONTHS_LONG, fmtPhone, inr, toPaise, toRupeesInput } from '../lib/format.js';

function StaffForm({ person, isOwner, onClose }) {
  const { dispatch, notify } = useStore();
  const [name, setName] = useState(person?.name || '');
  const [phone, setPhone] = useState(person?.phone || '');
  const [role, setRole] = useState(person?.role || STAFF_ROLES[0]);
  const [wage, setWage] = useState(toRupeesInput(person?.dailyWage));
  const [active, setActive] = useState(person ? person.active : true);
  const [touched, setTouched] = useState(false);

  const digits = phone.replace(/\D/g, '');
  const errors = {};
  if (!name.trim()) errors.name = 'Enter the name.';
  if (phone.trim() && digits.length !== 10) errors.phone = 'A phone number has 10 digits. Leave it empty if you do not have one.';
  if (isOwner && wage.trim() && !/^\d+(\.\d{1,2})?$/.test(wage.replace(/[₹,\s]/g, ''))) errors.wage = 'Type the wage in rupees, for example 600.';

  const save = () => {
    setTouched(true);
    if (Object.keys(errors).length) return;
    const fields = { name: name.trim(), phone: digits, role, active };
    // Only owners set wages. A person added by the manager has no wage until an owner sets one.
    if (isOwner) fields.dailyWage = toPaise(wage);
    if (person) dispatch({ type: 'updateStaff', id: person.id, fields });
    else dispatch({ type: 'addStaff', staff: { ...fields, dailyWage: isOwner ? toPaise(wage) : 0 } });
    notify(person ? `${fields.name} updated` : `${fields.name} added to staff`);
    onClose();
  };

  return (
    <Modal
      title={person ? 'Edit staff member' : 'Add a staff member'}
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>{person ? 'Save changes' : 'Add staff member'}</button></>}
    >
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="form-grid">
          <Field label="Name" error={touched && errors.name} full><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></Field>
          <Field label="Phone (optional)" error={touched && errors.phone}><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="off" /></Field>
          <Field label="Work"><select value={role} onChange={(e) => setRole(e.target.value)}>{STAFF_ROLES.map((r) => <option key={r}>{r}</option>)}</select></Field>
          {isOwner && (
            <Field label="Daily wage" error={touched && errors.wage} hint="Paid in full for a present day, half for a half day.">
              <MoneyInput value={wage} onChange={(e) => setWage(e.target.value)} />
            </Field>
          )}
          {person && (
            <div className="field">
              <span className="lab">Still working here</span>
              <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Yes, show in the attendance list</label>
            </div>
          )}
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export default function Staff() {
  const { state, data, isOwner, today } = useStore();
  const [edit, setEdit] = useState(null); // null | 'new' | staff object
  const [ym, setYm] = useState(today.slice(0, 7));
  const [showStopped, setShowStopped] = useState(false);

  const shift = (n) => {
    const [y, m] = ym.split('-').map(Number);
    const t = y * 12 + (m - 1) + n;
    setYm(`${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`);
  };
  const [yy, mm] = ym.split('-').map(Number);

  // Days worked and wages for the chosen month. Cancelled bookings do not count.
  const summary = useMemo(() => {
    const byStaff = new Map();
    const bookingById = new Map(state.bookings.map((b) => [b.id, b]));
    for (const a of state.attendance) {
      const b = bookingById.get(a.bookingId);
      if (!b || b.status === 'Cancelled' || b.date.slice(0, 7) !== ym) continue;
      const e = byStaff.get(a.staffId) || { days: 0, events: 0, wage: 0 };
      e.days += ATT_FACTOR[a.status];
      if (a.status !== 'absent') e.events += 1;
      e.wage += a.wageApplied || 0;
      byStaff.set(a.staffId, e);
    }
    return byStaff;
  }, [state.attendance, state.bookings, ym]);

  const people = [...state.staff].sort((a, b) => a.name.localeCompare(b.name));
  const shown = people.filter((p) => showStopped || p.active);
  const stopped = people.length - people.filter((p) => p.active).length;
  const monthRows = people.filter((p) => summary.has(p.id));
  const monthWage = monthRows.reduce((s, p) => s + summary.get(p.id).wage, 0);
  void data;

  return (
    <>
      <PageHead title="Staff">
        <button className="btn primary" onClick={() => setEdit('new')}><Icon name="plus" />Add staff member</button>
      </PageHead>

      <div className="card">
        <div className="card-head">
          <h2>People</h2>
          {stopped > 0 && <label className="small row" style={{ gap: 6 }}><input type="checkbox" checked={showStopped} onChange={(e) => setShowStopped(e.target.checked)} />Show {stopped} who stopped working here</label>}
        </div>
        {shown.length === 0 ? (
          <Empty title="No staff yet" action={<button className="btn primary" onClick={() => setEdit('new')}>Add the first person</button>}>
            Add the people who work your events. Then you can mark who came on each event day.
          </Empty>
        ) : (
          shown.map((p) => (
            <div className="list-row" key={p.id}>
              <div className="grow">
                <div className="t">{p.name}{!p.active && <span className="pill Completed" style={{ marginLeft: 8 }}>Stopped</span>}</div>
                <div className="small muted">
                  {p.role}{p.phone ? ` · ${fmtPhone(p.phone)}` : ''}
                  {isOwner && (p.dailyWage > 0 ? ` · ${inr(p.dailyWage)} a day` : '')}
                </div>
                {isOwner && p.dailyWage === 0 && p.active && <div className="small" style={{ color: '#7a5600' }}>Wage not set yet. Edit to add it.</div>}
              </div>
              <button className="btn small" onClick={() => setEdit(p)}>Edit</button>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <div><h2>Attendance for {MONTHS_LONG[mm - 1]} {yy}</h2><p>A present day counts as 1, a half day as 0.5.</p></div>
          <div className="row">
            <button className="btn small" onClick={() => shift(-1)} aria-label="Previous month">‹ Previous</button>
            <button className="btn small" onClick={() => shift(1)} aria-label="Next month">Next ›</button>
          </div>
        </div>
        {monthRows.length === 0 ? (
          <p className="muted">No attendance was marked in this month.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Work</th><th className="right">Events</th><th className="right">Days worked</th>{isOwner && <th className="right">Wage due</th>}</tr>
              </thead>
              <tbody>
                {monthRows.map((p) => {
                  const s = summary.get(p.id);
                  return (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td className="muted">{p.role}</td>
                      <td className="right num">{s.events}</td>
                      <td className="right num">{s.days}</td>
                      {isOwner && <td className="right num"><b>{inr(s.wage)}</b></td>}
                    </tr>
                  );
                })}
              </tbody>
              {isOwner && (
                <tfoot>
                  <tr><td colSpan={4}><b>Total for the month</b></td><td className="right num"><b>{inr(monthWage)}</b></td></tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {edit && <StaffForm person={edit === 'new' ? null : edit} isOwner={isOwner} onClose={() => setEdit(null)} />}
    </>
  );
}
