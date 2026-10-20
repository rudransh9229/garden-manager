import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { Icon, PageHead } from '../components/ui.jsx';
import { parseCSV, downloadText, toCSV } from '../lib/csv.js';
import { parseFlexibleDate } from '../lib/dates.js';
import { fmtDate, inr, plural } from '../lib/format.js';
import { newId } from '../lib/reducer.js';

// What each column of the old records is called. Only the date and the name are needed.
const FIELDS = [
  { key: 'date', label: 'Event date', required: true, match: /date|day|tarikh/i },
  { key: 'name', label: 'Client name', required: true, match: /client|name|party|customer/i },
  { key: 'phone', label: 'Phone', match: /phone|mobile|contact|number/i },
  { key: 'type', label: 'Booking type', match: /type|event|function|occasion/i },
  { key: 'total', label: 'Total price', match: /total|price|cost|rate|rent|amount/i },
  { key: 'received', label: 'Amount received', match: /receiv|advance|paid|deposit/i },
  { key: 'status', label: 'Status', match: /status|cancel/i },
  { key: 'notes', label: 'Notes', match: /note|remark|detail|comment/i },
];
const DETECT_ORDER = ['received', 'status', 'notes', 'phone', 'date', 'type', 'total', 'name'];

function detectColumns(headers) {
  const map = Object.fromEntries(FIELDS.map((f) => [f.key, -1]));
  const used = new Set();
  for (const key of DETECT_ORDER) {
    const f = FIELDS.find((x) => x.key === key);
    const i = headers.findIndex((h, idx) => !used.has(idx) && f.match.test(h));
    if (i >= 0) { map[key] = i; used.add(i); }
  }
  return map;
}

/** Rupees typed by a person -> paise. Empty is 0. Returns null when it is not a number. */
function money(cell) {
  const s = String(cell ?? '').replace(/^\s*Rs\.?/i, '').replace(/[₹,\s]/g, '');
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

const TEMPLATE = toCSV([
  ['Date', 'Client name', 'Phone', 'Booking type', 'Total price', 'Amount received', 'Status', 'Notes'],
  ['04/11/2023', 'Sample Client One', '9000000001', 'Wedding', '250000', '250000', '', 'Example row. Delete it.'],
  ['18/02/2022', 'Sample Client Two', '', 'Birthday', '', '', '', 'Only a name and a date is enough.'],
  ['09/12/2021', 'Sample Client Three', '', 'Engagement', '80000', '20000', 'Cancelled', 'Kept the advance.'],
]);

export default function Import() {
  const { state, dispatch, act, today } = useStore();
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileErr, setFileErr] = useState('');
  const [map, setMap] = useState(null);
  const [done, setDone] = useState(null);
  const fileRef = useRef(null);

  const table = useMemo(() => (text.trim() ? parseCSV(text) : []), [text]);
  const headers = (table[0] || []).map((h) => String(h).trim());
  const body = table.slice(1);
  const cols = map || detectColumns(headers);
  const types = state.settings.eventTypes;

  const result = useMemo(() => {
    if (!body.length) return { rows: [], ready: [], newTypes: [] };
    const known = new Set(state.bookings.map((b) => `${b.date}|${(state.clients.find((c) => c.id === b.clientId)?.name || '').trim().toLowerCase()}`));
    const seen = new Set();
    const typeByLower = new Map(types.map((t) => [t.toLowerCase(), t]));
    const newTypes = new Map();
    const cell = (row, key) => (cols[key] >= 0 ? String(row[cols[key]] ?? '').trim() : '');

    const rows = body.map((row, i) => {
      const line = i + 2;
      const errors = [];
      const notes = [];
      const date = parseFlexibleDate(cell(row, 'date'));
      const name = cell(row, 'name');
      if (!date) errors.push(cell(row, 'date') ? `"${cell(row, 'date')}" is not a date like 4 Nov 2023` : 'Date is empty');
      if (!name) errors.push('Name is empty');
      let total = money(cell(row, 'total'));
      let received = money(cell(row, 'received'));
      if (total === null) { errors.push('Total price is not a number'); total = 0; }
      if (received === null) { errors.push('Amount received is not a number'); received = 0; }
      if (total > 0 && received > total) errors.push('Amount received is more than the total price');
      if (total === 0 && received > 0) { total = received; notes.push('No price, so the price is set to the amount received'); }

      const phoneDigits = cell(row, 'phone').replace(/\D/g, '');
      if (phoneDigits && phoneDigits.length !== 10) notes.push('Phone does not have 10 digits');

      const rawType = cell(row, 'type');
      let eventType = types[types.length - 1];
      if (rawType) {
        const hit = typeByLower.get(rawType.toLowerCase());
        if (hit) eventType = hit;
        else { eventType = newTypes.get(rawType.toLowerCase()) || rawType; newTypes.set(rawType.toLowerCase(), eventType); notes.push(`New booking type "${rawType}"`); }
      } else if (typeByLower.has('other')) eventType = typeByLower.get('other');

      const cancelled = /cancel/i.test(cell(row, 'status'));
      let skip = '';
      if (!errors.length) {
        const key = `${date}|${name.toLowerCase()}`;
        if (known.has(key)) skip = 'Already in the app';
        else if (seen.has(key)) skip = 'Repeated in this file';
        seen.add(key);
      }
      const ok = !errors.length && !skip;
      const item = ok ? {
        client: { name, phone: phoneDigits },
        booking: {
          id: newId('b'), date, eventType, total, notes: cell(row, 'notes'), guests: 0, source: 'imported',
          status: cancelled || date <= today ? 'Completed' : 'Confirmed',
        },
        advance: received > 0 ? { amount: received, date: date > today ? today : date, mode: 'Cash', note: 'Imported' } : null,
        cancelled: cancelled ? { kept: received, date: date > today ? today : date, reason: 'Imported from old records' } : null,
      } : null;
      return { line, date, name, eventType, total, received, cancelled, errors, notes, skip, ok, item };
    });
    return { rows, ready: rows.filter((r) => r.ok), newTypes: [...newTypes.values()] };
  }, [body, cols, state.bookings, state.clients, types, today]);

  const problems = result.rows.filter((r) => r.errors.length);
  const skipped = result.rows.filter((r) => r.skip);

  const load = async (file) => {
    setFileErr('');
    setDone(null);
    if (!file) return;
    if (/\.xlsx?$/i.test(file.name)) {
      setFileErr('This is an Excel file. In Excel choose File, Save As, then CSV. Or select the cells, copy them, and paste them in the box below.');
      return;
    }
    try {
      setText(await file.text());
      setFileName(file.name);
      setMap(null);
    } catch {
      setFileErr('That file could not be read. Try saving it as CSV again.');
    }
  };

  const run = () => {
    if (!result.ready.length) return;
    for (const t of result.newTypes) dispatch({ type: 'addEventType', name: t });
    act({ type: 'importBookings', items: result.ready.map((r) => r.item) }, `Imported ${plural(result.ready.length, 'event')}`);
    setDone({ count: result.ready.length, skipped: skipped.length, problems: problems.length });
    setText('');
    setFileName('');
    setMap(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const missing = FIELDS.filter((f) => f.required && cols[f.key] < 0);

  return (
    <>
      <PageHead title="Import old records" sub="Only the event date and client name are needed." />

      {done && (
        <div className="note good" style={{ marginBottom: 16 }}>
          <b>{plural(done.count, 'event')} imported.</b>
          {done.skipped > 0 && ` ${done.skipped} were already in the app and left alone.`}
          {done.problems > 0 && ` ${plural(done.problems, 'row')} had problems and were not imported.`}{' '}
          <Link to="/events">See them in Events</Link> or <Link to="/invoices">attach their invoices</Link>.
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <div><h2>1. Add your records</h2><p>Use a CSV file, or copy the rows from Excel and paste them below. The first row must be the column names.</p></div>
          <button className="btn small" onClick={() => downloadText('garden-import-template.csv', TEMPLATE)}>Download an example sheet</button>
        </div>
        <div className="row" style={{ marginBottom: 12 }}>
          <input ref={fileRef} type="file" accept=".csv,.txt,text/csv" onChange={(e) => load(e.target.files?.[0])} aria-label="Choose a CSV file" />
          {fileName && <span className="small muted">{fileName}</span>}
        </div>
        {fileErr && <div className="note bad" style={{ marginBottom: 12 }} role="alert">{fileErr}</div>}
        <label className="small muted" htmlFor="paste">Or paste the rows here</label>
        <textarea id="paste" rows={5} value={text} onChange={(e) => { setText(e.target.value); setFileName(''); setMap(null); setDone(null); }} placeholder={'Date\tClient name\tBooking type\tTotal price\n04/11/2023\tRajesh Sharma\tWedding\t250000'} style={{ width: '100%', fontFamily: 'ui-monospace, monospace', fontSize: 13 }} />
      </div>

      {table.length > 0 && (
        <>
          <div className="card">
            <div className="card-head"><div><h2>2. Check the columns</h2></div></div>
            <div className="form-grid">
              {FIELDS.map((f) => (
                <div className="field" key={f.key}>
                  <label htmlFor={`col-${f.key}`}>{f.label}{f.required ? '' : ' (optional)'}</label>
                  <select id={`col-${f.key}`} value={cols[f.key]} onChange={(e) => setMap({ ...cols, [f.key]: Number(e.target.value) })}>
                    <option value={-1}>{f.required ? 'Choose a column' : 'Not in my records'}</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {missing.length > 0 && <div className="note bad" role="alert">Choose the column for: {missing.map((m) => m.label).join(', ')}.</div>}
          </div>

          {missing.length === 0 && (
            <div className="card">
              <div className="card-head">
                <div><h2>3. Check and import</h2></div>
                <button className="btn primary" onClick={run} disabled={!result.ready.length}><Icon name="upload" />Import {plural(result.ready.length, 'event')}</button>
              </div>
              <div className="grid cols-3" style={{ marginBottom: 14 }}>
                <div className="card kpi" style={{ boxShadow: 'none' }}><div className="label">Ready to import</div><div className="value good">{result.ready.length}</div></div>
                <div className="card kpi" style={{ boxShadow: 'none' }}><div className="label">Already in the app</div><div className="value">{skipped.length}</div><div className="sub">Same date and same name. Left alone.</div></div>
                <div className="card kpi" style={{ boxShadow: 'none' }}><div className="label">Need fixing</div><div className={`value ${problems.length ? 'bad' : ''}`}>{problems.length}</div><div className="sub">Not imported until fixed.</div></div>
              </div>
              {result.newTypes.length > 0 && <div className="note info" style={{ marginBottom: 12 }}>New booking types will be added: {result.newTypes.join(', ')}. You can rename or remove them in Settings.</div>}
              {problems.length > 0 && <div className="note" style={{ marginBottom: 12 }}>Fix the rows marked in red in your sheet and add it again, or import the good rows now and add the rest by hand.</div>}
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Row</th><th>Date</th><th>Client</th><th className="hide-sm">Type</th><th className="right hide-sm">Price</th><th>Result</th></tr></thead>
                  <tbody>
                    {result.rows.slice(0, 100).map((r) => (
                      <tr key={r.line}>
                        <td className="faint">{r.line}</td>
                        <td>{r.date ? fmtDate(r.date) : '—'}</td>
                        <td>{r.name || '—'}{r.cancelled && <span className="pill Cancelled" style={{ marginLeft: 8 }}>Cancelled</span>}</td>
                        <td className="hide-sm">{r.eventType}</td>
                        <td className="right num hide-sm">{r.total ? inr(r.total) : '—'}</td>
                        <td>
                          {r.errors.length > 0 && <span className="bad">{r.errors.join('. ')}</span>}
                          {r.skip && <span className="muted">{r.skip}</span>}
                          {r.ok && (r.notes.length ? <span style={{ color: '#7a5600' }}>OK. {r.notes.join('. ')}</span> : <span className="good">OK</span>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.rows.length > 100 && <p className="small muted" style={{ marginTop: 8 }}>Showing the first 100 of {result.rows.length} rows. All of them are checked.</p>}
            </div>
          )}
        </>
      )}
    </>
  );
}
