import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { Field, Modal, MoneyInput } from './ui.jsx';
import { isValidISO } from '../lib/dates.js';
import { fmtDate, inr, toPaise } from '../lib/format.js';

/** Cancel a booking and decide what happens to the advance. Nothing is deleted; Restore brings it back. */
export default function CancelDialog({ row, onClose }) {
  const { act, today } = useStore();
  const received = row.received;
  const [choice, setChoice] = useState(received > 0 ? 'full' : 'none');
  const [kept, setKept] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(today);
  const keptP = choice === 'full' ? received : choice === 'none' ? 0 : toPaise(kept);
  const partBad = choice === 'part' && (kept === '' || keptP > received);
  const dateBad = !isValidISO(date);
  const disabled = partBad || dateBad;

  const confirm = () => {
    if (disabled) return;
    act({ type: 'cancelBooking', bookingId: row.id, choice, kept: keptP, reason: reason.trim(), date }, `Booking cancelled. ${keptP > 0 ? `${inr(keptP)} added to revenue.` : 'Nothing added to revenue.'}`);
    onClose();
  };

  const opt = (value, title, text) => (
    <label className={`choice${choice === value ? ' on' : ''}`}>
      <input type="radio" name="adv" checked={choice === value} onChange={() => setChoice(value)} disabled={received === 0 && value !== 'none'} />
      <span><b style={{ fontWeight: 500 }}>{title}</b><br /><span className="small muted">{text}</span></span>
    </label>
  );

  return (
    <Modal
      title={`Cancel ${row.client.name}'s booking`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Keep the booking</button>
          <button className="btn danger solid" onClick={confirm} disabled={disabled}>Cancel booking</button>
        </>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        {fmtDate(row.booking.date)} · {row.eventType}. Advance received so far: <b>{inr(received)}</b>.
      </p>
      {received === 0 ? (
        <div className="note info" style={{ marginBottom: 12 }}>No advance was received, so nothing will be added to revenue.</div>
      ) : (
        <>
          {opt('full', 'Keep the full advance', `${inr(received)} counts as revenue (Cancellation income).`)}
          {opt('part', 'Keep part, refund the rest', 'You type how much you keep. The rest is recorded as refunded.')}
          {opt('none', 'Refund everything', 'Nothing counts as revenue.')}
        </>
      )}
      {choice === 'part' && (
        <Field label="Amount you keep" error={kept !== '' && keptP > received ? `It cannot be more than ${inr(received)}.` : undefined} hint={kept !== '' && keptP <= received ? `${inr(received - keptP)} will be recorded as refunded.` : undefined}>
          <MoneyInput value={kept} onChange={(e) => setKept(e.target.value)} placeholder="0" />
        </Field>
      )}
      <div className="form-grid">
        <Field label="Cancelled on" error={dateBad ? 'Pick a valid date.' : undefined}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Reason (optional)">
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
      <div className="note good">
        {keptP > 0 ? `${inr(keptP)} will be added to revenue as Cancellation income.` : 'Nothing will be added to revenue.'} The event price and its pending balance stop counting, and the date becomes free.
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>You can undo this right after, or use Restore booking any time later.</p>
    </Modal>
  );
}
