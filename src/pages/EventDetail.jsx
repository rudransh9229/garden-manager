import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { useUi } from '../uiContext.jsx';
import { Confirm, Field, MoneyInput, StatusPill } from '../components/ui.jsx';
import AttendancePanel from '../components/AttendancePanel.jsx';
import DocFileActions from '../components/DocFileActions.jsx';
import { addDays, isValidISO } from '../lib/dates.js';
import { fmtDate, fmtPhone, inr, plural, toPaise, toRupeesInput } from '../lib/format.js';
import { expenseCategories, MANAGER_EDIT_DAYS, PAYMENT_MODES } from '../lib/constants.js';

export default function EventDetail() {
  const { id } = useParams();
  const { data, state, isOwner, act, dispatch, notify, today } = useStore();
  const ui = useUi();
  const nav = useNavigate();
  const row = data.rowById.get(id);
  const [askDelete, setAskDelete] = useState(false);
  const [editKept, setEditKept] = useState(null);

  if (!row) {
    return (
      <div className="page">
        <Link to="/events" className="back">← All events</Link>
        <div className="card empty"><h3>This event is not here</h3><p>It may have been deleted. Go back to the list to find another one.</p></div>
      </div>
    );
  }

  const b = row.booking;
  const cancelled = b.status === 'Cancelled';
  const cancel = row.cancellation;
  const payments = state.payments.filter((p) => p.bookingId === id).sort((a, c) => (a.date < c.date ? -1 : 1));
  const expenses = state.expenses.filter((e) => e.bookingId === id).sort((a, c) => (a.date < c.date ? -1 : 1));
  const docs = state.documents.filter((d) => d.bookingId === id).sort((a, c) => (a.uploadedAt < c.uploadedAt ? 1 : -1));
  const lastCancel = state.cancellations.filter((c) => c.bookingId === id).slice(-1)[0];
  const canMark = isOwner || b.date >= addDays(today, -MANAGER_EDIT_DAYS);
  const paidPct = b.total > 0 ? Math.min(100, Math.round((row.received / b.total) * 100)) : 0;

  const remove = () => {
    act({ type: 'deleteBooking', bookingId: id, date: today }, `Booking for ${row.client.name} moved to the bin`);
    nav('/events');
  };

  return (
    <div className="page">
      <Link to="/events" className="back">← All events</Link>
      <div className="detail-head">
        <div>
          <div className="row">
            <h1>{row.client.name}</h1>
            <StatusPill status={b.status} />
            {b.source === 'imported' && <span className="pill Imported">Imported</span>}
          </div>
          <div className="meta">
            <span>{fmtDate(b.date)}</span>
            <span>{row.eventType}</span>
            {b.guests > 0 && <span>{b.guests} guests</span>}
            {isOwner && row.client.phone && <span>{fmtPhone(row.client.phone)}</span>}
            {isOwner && row.client.address && <span>{row.client.address}</span>}
          </div>
          {b.notes && <p className="muted" style={{ marginTop: 6 }}>{b.notes}</p>}
        </div>
        {isOwner && (
          <div className="page-actions">
            <button className="btn" onClick={() => ui.editBooking(row)}>Edit</button>
            {cancelled ? (
              cancel && <button className="btn primary" onClick={() => act({ type: 'restoreBooking', bookingId: id, date: today }, 'Booking restored')}>Restore booking</button>
            ) : (
              <button className="btn danger" onClick={() => ui.cancelBooking(row)}>Cancel booking</button>
            )}
            <button className="btn danger" onClick={() => setAskDelete(true)}>Delete</button>
          </div>
        )}
      </div>

      <div className="stack">
        {isOwner && cancelled && (
          <section className="card">
            <div className="card-head"><h2>Cancelled</h2></div>
            {cancel ? (
              <>
                <p className="muted">
                  Cancelled on {fmtDate(cancel.cancelledAt)}{cancel.reason ? `. Reason: ${cancel.reason}` : ''}. The event price and balance do not count. Only the advance you kept is in your revenue.
                </p>
                <div className="profit-box" style={{ margin: '14px 0' }}>
                  <div><div className="l">Advance received</div><div className="v num">{inr(cancel.advanceReceived)}</div></div>
                  <div><div className="l">Kept (cancellation income)</div><div className="v num good">{inr(cancel.advanceKept)}</div></div>
                  <div><div className="l">Refunded</div><div className="v num">{inr(cancel.refunded)}</div></div>
                  <div><div className="l">Was due before</div><div className="v num faint">{inr(b.total)}</div></div>
                </div>
                {editKept === null ? (
                  <div className="row">
                    <button className="btn small" onClick={() => setEditKept(toRupeesInput(cancel.advanceKept))}>Change the kept amount</button>
                    <button className="btn small primary" onClick={() => act({ type: 'restoreBooking', bookingId: id, date: today }, 'Booking restored')}>Restore booking</button>
                  </div>
                ) : (
                  <div className="row" style={{ alignItems: 'flex-end' }}>
                    <Field label={`Amount kept (up to ${inr(cancel.advanceReceived)})`} error={toPaise(editKept) > cancel.advanceReceived ? 'More than the advance received.' : undefined}>
                      <MoneyInput value={editKept} onChange={(e) => setEditKept(e.target.value)} />
                    </Field>
                    <button className="btn primary" style={{ marginBottom: 12 }} disabled={toPaise(editKept) > cancel.advanceReceived} onClick={() => { dispatch({ type: 'editCancellation', bookingId: id, kept: toPaise(editKept), date: today }); setEditKept(null); notify('Kept amount updated'); }}>Save</button>
                    <button className="btn" style={{ marginBottom: 12 }} onClick={() => setEditKept(null)}>Close</button>
                  </div>
                )}
                {lastCancel?.history?.length > 0 && (
                  <details style={{ marginTop: 10 }}>
                    <summary className="small muted" style={{ cursor: 'pointer' }}>History ({lastCancel.history.length})</summary>
                    <ul className="small muted" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                      {lastCancel.history.map((h, i) => (
                        <li key={i}>{fmtDate(h.at)}: {h.action === 'cancel' ? `cancelled, kept ${inr(h.newKept)}` : h.action === 'edit' ? `kept amount changed from ${inr(h.oldKept)} to ${inr(h.newKept)}` : 'restored'} ({h.by})</li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            ) : (
              <p className="muted">This booking was cancelled earlier and then restored in the records. Use Edit to change its status.</p>
            )}
          </section>
        )}

        {isOwner && !cancelled && (
          <section className="card">
            <div className="card-head">
              <h2>Money</h2>
              {!row.counted && <span className="small muted">Counts as revenue once the status is Confirmed</span>}
            </div>
            <div className="profit-box">
              <div><div className="l">Agreed price</div><div className="v num">{inr(b.total)}</div></div>
              <div><div className="l">Received</div><div className="v num">{inr(row.received)}</div></div>
              <div><div className="l">Balance due</div><div className="v num">{inr(Math.max(0, b.total - row.received))}</div></div>
              <div><div className="l">Profit so far</div><div className={`v num ${row.profit < 0 ? 'bad' : ''}`}>{row.counted ? inr(row.profit) : 'Not counted'}</div></div>
            </div>
            <div className="progress" style={{ marginTop: 14 }} role="img" aria-label={`${paidPct}% of the price received`}><i style={{ width: `${paidPct}%` }} /></div>
            <p className="small muted" style={{ marginTop: 6 }}>
              {paidPct}% received{row.payState ? ` · ${row.payState}` : ''}{row.received > b.total ? ` · ${inr(row.received - b.total)} more than the price` : ''}
            </p>
          </section>
        )}

        {isOwner && (
          <div className="grid cols-2" style={{ alignItems: 'start' }}>
            <PaymentsCard id={id} payments={payments} total={b.total} />
            <ExpensesCard id={id} expenses={expenses} labour={row.labour} />
          </div>
        )}

        <section className="card">
          <div className="card-head">
            <h2>Staff and attendance</h2>
            {!isOwner && <span className="small muted">Mark who came to work this event</span>}
          </div>
          {cancelled ? (
            <p className="muted">This booking is cancelled, so there is no staff to mark.</p>
          ) : (
            <AttendancePanel
              row={row}
              canEdit={canMark}
              showWages={isOwner}
              lockedMessage={`Attendance can be changed for events in the last ${MANAGER_EDIT_DAYS} days. Ask an owner to change older ones.`}
            />
          )}
        </section>

        {isOwner && (
          <section className="card">
            <div className="card-head">
              <h2>Invoices and documents</h2>
              <button className="btn small" onClick={() => ui.addInvoice(id)}>Add invoice</button>
            </div>
            {docs.length === 0 ? (
              <p className="muted">No invoice is on file for this event.{row.counted && b.date < today ? ' Add the old one so it is kept with the booking.' : ''}</p>
            ) : (
              <div className="list">
                {docs.map((d) => (
                  <div className="list-row" key={d.id}>
                    <div className="grow">
                      <div className="t">{d.number || d.name}</div>
                      <div className="small muted">{d.type} · added {fmtDate(d.uploadedAt)}{d.hasFile ? ` · ${d.name}` : ''}</div>
                    </div>
                    <DocFileActions doc={d} />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {askDelete && (
        <Confirm title="Delete this booking?" confirmLabel="Delete booking" danger onConfirm={remove} onClose={() => setAskDelete(false)}>
          <p>This removes <b>{row.client.name}</b>, {fmtDate(b.date)}, together with {plural(payments.length, 'payment')}{payments.length ? ` (${inr(row.received)})` : ''}, {plural(expenses.length, 'expense')}, {plural(state.attendance.filter((a) => a.bookingId === id).length, 'attendance record')} and {plural(docs.length, 'document')}.</p>
          <p className="note">If the client cancelled, use <b>Cancel booking</b> instead. It keeps the record and lets you count the advance as revenue. Delete is for entries made by mistake.</p>
          <p className="small muted">You will have a few seconds to press Undo afterwards.</p>
        </Confirm>
      )}
    </div>
  );
}

function PaymentsCard({ id, payments, total }) {
  const { dispatch, act, notify, today } = useStore();
  const [f, setF] = useState({ amount: '', date: today, mode: 'UPI', note: '' });
  const [touched, setTouched] = useState(false);
  const amt = toPaise(f.amount);
  const err = !amt ? 'Enter the amount received.' : !isValidISO(f.date) ? 'Pick a valid date.' : '';
  const add = () => {
    setTouched(true);
    if (err) return;
    dispatch({ type: 'addPayment', payment: { bookingId: id, amount: amt, date: f.date, mode: f.mode, note: f.note.trim() } });
    notify(`${inr(amt)} payment added`);
    setF({ amount: '', date: today, mode: f.mode, note: '' });
    setTouched(false);
  };
  const received = payments.reduce((s, p) => s + p.amount, 0);
  return (
    <section className="card">
      <div className="card-head"><h2>Payments</h2><span className="small muted">{inr(received)} of {inr(total)}</span></div>
      {payments.length === 0 ? <p className="muted">No payment recorded yet.</p> : (
        <div className="list">
          {payments.map((p) => (
            <div className="list-row" key={p.id}>
              <div className="grow">
                <div className="t num">{inr(p.amount)}</div>
                <div className="small muted">{fmtDate(p.date)} · {p.mode}{p.note ? ` · ${p.note}` : ''}</div>
              </div>
              <button className="btn small danger" onClick={() => act({ type: 'deletePayment', id: p.id }, `${inr(p.amount)} payment removed`)} aria-label={`Remove payment of ${inr(p.amount)}`}>Remove</button>
            </div>
          ))}
        </div>
      )}
      <hr className="sep" />
      <div className="form-grid">
        <Field label="Amount received" error={touched && !amt ? err : undefined}><MoneyInput value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0" /></Field>
        <Field label="Date" error={touched && amt && err ? err : undefined}><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Paid by"><select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>{PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Note"><input type="text" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Optional" /></Field>
      </div>
      <button className="btn primary" onClick={add}>Add payment</button>
    </section>
  );
}

function ExpensesCard({ id, expenses, labour }) {
  const { state, dispatch, act, notify, today } = useStore();
  const cats = expenseCategories(state.settings);
  const [f, setF] = useState({ category: cats[0], amount: '', date: today, note: '' });
  const [touched, setTouched] = useState(false);
  const amt = toPaise(f.amount);
  const err = !amt ? 'Enter the amount spent.' : !isValidISO(f.date) ? 'Pick a valid date.' : '';
  const add = () => {
    setTouched(true);
    if (err) return;
    dispatch({ type: 'addExpense', expense: { bookingId: id, category: f.category, amount: amt, date: f.date, note: f.note.trim() } });
    notify(`${inr(amt)} expense added`);
    setF({ ...f, amount: '', note: '' });
    setTouched(false);
  };
  const total = expenses.reduce((s, e) => s + e.amount, 0) + labour;
  return (
    <section className="card">
      <div className="card-head"><h2>Expenses</h2><span className="small muted">Total {inr(total)}</span></div>
      <div className="list">
        <div className="list-row">
          <div className="grow"><div className="t num">{inr(labour)}</div><div className="small muted">Labour, worked out from attendance</div></div>
        </div>
        {expenses.map((e) => (
          <div className="list-row" key={e.id}>
            <div className="grow">
              <div className="t num">{inr(e.amount)} <span className="muted" style={{ fontWeight: 400 }}>· {e.category}</span></div>
              <div className="small muted">{fmtDate(e.date)}{e.vendor ? ` · ${e.vendor}` : ''}{e.note ? ` · ${e.note}` : ''}{e.paid === false ? ' · not paid yet' : ''}</div>
            </div>
            <button className="btn small danger" onClick={() => act({ type: 'deleteExpense', id: e.id }, `${inr(e.amount)} expense removed`)} aria-label={`Remove expense of ${inr(e.amount)}`}>Remove</button>
          </div>
        ))}
      </div>
      <hr className="sep" />
      <div className="form-grid">
        <Field label="What was it for?"><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{(cats.includes(f.category) ? cats : [f.category, ...cats]).map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Amount spent" error={touched && !amt ? err : undefined}><MoneyInput value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0" /></Field>
        <Field label="Date" error={touched && amt && err ? err : undefined}><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Note"><input type="text" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Optional" /></Field>
      </div>
      <button className="btn primary" onClick={add}>Add expense</button>
    </section>
  );
}
