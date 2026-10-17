import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { Field, Modal, MoneyInput } from './ui.jsx';
import { newId } from '../lib/reducer.js';
import { isValidISO } from '../lib/dates.js';
import { fmtDate, inr, toPaise, toRupeesInput } from '../lib/format.js';
import { PAYMENT_MODES } from '../lib/constants.js';

/** Add a booking (row = null) or edit one (row = a computed event row). */
export default function BookingForm({ row = null, defaultDate, onClose }) {
  const { state, data, dispatch, notify, today } = useStore();
  const nav = useNavigate();
  const editing = !!row;
  const types = state.settings.eventTypes;
  const startDate = row?.booking.date || defaultDate || today;
  const [f, setF] = useState({
    name: row?.client.name || '',
    phone: row?.client.phone || '',
    address: row?.client.address || '',
    date: startDate,
    type: row?.booking.eventType && types.includes(row.booking.eventType) ? row.booking.eventType : types[0],
    guests: row?.booking.guests ? String(row.booking.guests) : '',
    total: row ? toRupeesInput(row.booking.total) : '',
    status: row?.booking.status || (startDate < today ? 'Completed' : 'Confirmed'),
    notes: row?.booking.notes || '',
    advance: '',
    advDate: today,
    advMode: 'UPI',
  });
  const [touched, setTouched] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const otherBookings = editing ? data.rows.filter((r) => r.booking.clientId === row.booking.clientId && r.id !== row.id).length : 0;
  const clash = useMemo(
    () => (isValidISO(f.date) ? data.rows.filter((r) => r.booking.date === f.date && r.id !== row?.id && r.booking.status !== 'Cancelled') : []),
    [data.rows, f.date, row],
  );
  const knownNames = useMemo(() => [...new Set(state.clients.map((c) => c.name))].sort(), [state.clients]);

  const total = toPaise(f.total);
  const advance = toPaise(f.advance);
  const errors = {};
  if (!f.name.trim()) errors.name = 'Enter the client name.';
  if (f.phone && !/^\d{10}$/.test(f.phone.replace(/\s/g, ''))) errors.phone = 'Enter a 10-digit mobile number, or leave it empty.';
  if (!isValidISO(f.date)) errors.date = 'Pick the event date.';
  if (f.total === '' || !/^[\d,.\s₹]+$/.test(f.total)) errors.total = 'Enter the agreed price in rupees.';
  if (f.guests && !/^\d+$/.test(f.guests)) errors.guests = 'Use numbers only.';
  if (!editing && advance > total && total > 0) errors.advance = 'The advance cannot be more than the price.';
  if (!editing && advance > 0 && !isValidISO(f.advDate)) errors.advDate = 'Pick the date you received it.';
  const bad = Object.keys(errors).length > 0;

  const onBlurName = () => {
    const m = state.clients.find((c) => c.name.toLowerCase() === f.name.trim().toLowerCase());
    if (m && !f.phone && !editing) setF((s) => ({ ...s, phone: m.phone || '', address: s.address || m.address || '' }));
  };

  const save = () => {
    setTouched(true);
    if (bad) return;
    const phone = f.phone.replace(/\s/g, '');
    if (editing) {
      dispatch({ type: 'updateClient', id: row.booking.clientId, fields: { name: f.name.trim(), phone, address: f.address.trim() } });
      dispatch({
        type: 'updateBooking',
        id: row.id,
        fields: { date: f.date, eventType: f.type, guests: Number(f.guests) || 0, total, notes: f.notes.trim(), ...(row.booking.status !== 'Cancelled' ? { status: f.status } : {}) },
      });
      notify('Changes saved');
      onClose();
      return;
    }
    const id = newId('b');
    dispatch({
      type: 'addBooking',
      client: { name: f.name.trim(), phone, address: f.address.trim() },
      booking: { id, date: f.date, eventType: f.type, guests: Number(f.guests) || 0, status: f.status, total, notes: f.notes.trim() },
      advance: advance > 0 ? { amount: advance, date: f.advDate, mode: f.advMode, note: 'Advance' } : null,
    });
    notify(`Booking added for ${f.name.trim()}`);
    onClose();
    nav(`/events/${id}`);
  };

  const err = (k) => (touched ? errors[k] : undefined);
  const statuses = ['Enquiry', 'Tentative', 'Confirmed', 'Completed'];

  return (
    <Modal
      title={editing ? 'Edit booking' : 'New booking'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn primary" onClick={save}>{editing ? 'Save changes' : 'Add booking'}</button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Client name" error={err('name')} full>
          <input type="text" list="known-clients" value={f.name} onChange={set('name')} onBlur={onBlurName} autoComplete="off" />
        </Field>
        <datalist id="known-clients">{knownNames.map((n) => <option key={n} value={n} />)}</datalist>
        <Field label="Mobile number" error={err('phone')}>
          <input type="tel" inputMode="numeric" value={f.phone} onChange={set('phone')} placeholder="10 digits" />
        </Field>
        <Field label="Town or address">
          <input type="text" value={f.address} onChange={set('address')} />
        </Field>
        <Field label="Event date" error={err('date')}>
          <input type="date" value={f.date} onChange={set('date')} />
        </Field>
        <Field label="Booking type">
          <select value={f.type} onChange={set('type')}>
            {!types.includes(f.type) && <option value={f.type}>{f.type}</option>}
            {types.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        {clash.length > 0 && (
          <div className="full note" style={{ marginBottom: 12 }}>
            {clash.length === 1 ? 'Another booking is already on' : `${clash.length} other bookings are already on`} {fmtDate(f.date)}: {clash.map((c) => c.client.name).join(', ')}. You can still save this one.
          </div>
        )}
        <Field label="Agreed price" error={err('total')}>
          <MoneyInput value={f.total} onChange={set('total')} placeholder="0" />
        </Field>
        <Field label="Number of guests" error={err('guests')}>
          <input type="text" inputMode="numeric" value={f.guests} onChange={set('guests')} placeholder="Optional" />
        </Field>
        <Field label="Status" hint={row?.booking.status === 'Cancelled' ? 'This booking is cancelled. Use Restore booking on its page to bring it back.' : 'To cancel, use the Cancel booking button on the booking page.'}>
          <select value={row?.booking.status === 'Cancelled' ? 'Cancelled' : f.status} onChange={set('status')} disabled={row?.booking.status === 'Cancelled'}>
            {row?.booking.status === 'Cancelled' && <option>Cancelled</option>}
            {statuses.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Notes">
          <input type="text" value={f.notes} onChange={set('notes')} placeholder="Optional" />
        </Field>
        {editing && otherBookings > 0 && (
          <div className="full note info" style={{ marginBottom: 12 }}>This client has {otherBookings} other booking{otherBookings > 1 ? 's' : ''}. A new name or number applies to all of them.</div>
        )}
        {!editing && (
          <>
            <div className="full"><hr className="sep" /><h3 style={{ marginBottom: 10 }}>Advance received (optional)</h3></div>
            <Field label="Amount" error={err('advance')}>
              <MoneyInput value={f.advance} onChange={set('advance')} placeholder="0" />
            </Field>
            <Field label="Date received" error={err('advDate')}>
              <input type="date" value={f.advDate} onChange={set('advDate')} />
            </Field>
            <Field label="Paid by">
              <select value={f.advMode} onChange={set('advMode')}>{PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}</select>
            </Field>
            {advance > 0 && total > 0 && advance <= total && <p className="small muted" style={{ alignSelf: 'center' }}>Balance after advance: {inr(total - advance)}</p>}
          </>
        )}
      </div>
    </Modal>
  );
}
