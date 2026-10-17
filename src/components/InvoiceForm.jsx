import React, { useMemo, useRef, useState } from 'react';
import { useStore } from '../store.jsx';
import { EventPicker, Field, Modal } from './ui.jsx';
import { newId } from '../lib/reducer.js';
import { prepareFile, putFile } from '../lib/files.js';
import { isValidISO } from '../lib/dates.js';
import { DOC_TYPES } from '../lib/constants.js';
import { fmtDate } from '../lib/format.js';


export function nextInvoiceNumber(documents, year) {
  const re = new RegExp(`^INV-${year}-(\\d+)$`);
  let max = 0;
  for (const d of documents) {
    const m = d.number && d.number.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `INV-${year}-${String(max + 1).padStart(3, '0')}`;
}

/** Add an invoice (or another document) to an event. eventId fixes the event; otherwise the person picks it. */
export default function InvoiceForm({ eventId = '', defaultType = 'Invoice', onClose }) {
  const { state, data, dispatch, notify, today } = useStore();
  const [ev, setEv] = useState(eventId);
  const [type, setType] = useState(defaultType);
  const [number, setNumber] = useState('');
  const [numberTouched, setNumberTouched] = useState(false);
  const [date, setDate] = useState(today);
  const [file, setFile] = useState(null);
  const [over, setOver] = useState(false);
  const [fileErr, setFileErr] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const row = data.rowById.get(ev);
  const extra = useMemo(() => {
    const m = new Map();
    for (const d of state.documents) m.set(d.bookingId, `${m.get(d.bookingId) || ''} ${d.number || ''}`);
    return m;
  }, [state.documents]);
  const suggested = row ? nextInvoiceNumber(state.documents, row.year) : '';
  const shownNumber = type === 'Invoice' ? (numberTouched ? number : suggested) : number;

  const dup = type === 'Invoice' && shownNumber.trim() && state.documents.find((d) => d.type === 'Invoice' && (d.number || '').toLowerCase() === shownNumber.trim().toLowerCase());
  const dupRow = dup ? data.rowById.get(dup.bookingId) : null;
  const errors = {};
  if (!ev) errors.ev = 'Pick the event this belongs to.';
  if (type === 'Invoice' && !shownNumber.trim()) errors.number = 'Enter the invoice number.';
  if (dup) errors.number = `This number is already used${dupRow ? ` for ${dupRow.client.name} (${fmtDate(dupRow.booking.date)})` : ''}. Use a different one.`;
  if (!isValidISO(date)) errors.date = 'Pick a valid date.';
  const bad = Object.keys(errors).length > 0;

  const take = async (f) => {
    setFileErr('');
    if (!f) return;
    try { setFile(await prepareFile(f)); } catch (e) { setFile(null); setFileErr(e.message); }
  };

  const save = async () => {
    setTouched(true);
    if (bad || saving) return;
    setSaving(true);
    const id = newId('d');
    try {
      if (file) await putFile(id, file.blob);
    } catch {
      setSaving(false);
      setFileErr('The file could not be saved, so the invoice was not saved. Check your connection and try again.');
      return;
    }
    dispatch({
      type: 'addDocument',
      doc: { id, bookingId: ev, type, number: shownNumber.trim() || undefined, name: file?.name || `${shownNumber.trim() || type}`, uploadedAt: date, size: file?.size, mime: file?.type, hasFile: !!file },
    });
    notify(`${type === 'Invoice' ? 'Invoice' : type} saved${file ? '' : '. No file attached yet.'}`);
    onClose();
  };

  return (
    <Modal
      title={type === 'Invoice' ? 'Add an invoice' : `Add ${type.toLowerCase()}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </>
      }
    >
      {eventId && row ? (
        <p className="muted" style={{ marginBottom: 12 }}>For {row.client.name}, {fmtDate(row.booking.date)}.</p>
      ) : (
        <>
          <EventPicker rows={data.rows} value={ev} onChange={setEv} extra={extra} />
          {touched && errors.ev && <p className="err small" role="alert" style={{ color: 'var(--red)', marginTop: -6, marginBottom: 10 }}>{errors.ev}</p>}
        </>
      )}
      <div className="form-grid">
        <Field label="What is it?">
          <select value={type} onChange={(e) => setType(e.target.value)}>{DOC_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label="Date" error={touched ? errors.date : undefined}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {type === 'Invoice' && (
          <Field label="Invoice number" hint="Filled in for you. Type your own if the paper invoice has a different number." error={touched || dup ? errors.number : undefined} full>
            <input type="text" value={shownNumber} onChange={(e) => { setNumberTouched(true); setNumber(e.target.value); }} placeholder="INV-2026-001" />
          </Field>
        )}
      </div>
      <div className="field">
        <span className="lab">File (PDF or photo)</span>
        <div
          className={`dropzone${over ? ' over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]); }}
        >
          {file ? (
            <div className="row" style={{ justifyContent: 'center' }}>
              <b style={{ fontWeight: 500 }}>{file.name}</b>
              <span className="small muted">{(file.size / 1024).toFixed(0)} KB</span>
              <button type="button" className="btn small" onClick={() => setFile(null)}>Remove</button>
            </div>
          ) : (
            <>
              <p className="muted">Drop the file here, or</p>
              <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => inputRef.current?.click()}>Choose a file</button>
              <p className="small faint" style={{ marginTop: 8 }}>You can also save without a file and attach the scan later.</p>
            </>
          )}
          <input ref={inputRef} type="file" accept="application/pdf,image/*" hidden onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        {fileErr && <span className="err" role="alert">{fileErr}</span>}
      </div>
    </Modal>
  );
}
