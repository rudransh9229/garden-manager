import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { Confirm, Field, Modal, PageHead } from '../components/ui.jsx';
import { buildBackup, readBackup, restoreFiles } from '../lib/backup.js';
import { MONTHS } from '../lib/format.js';
import { plural } from '../lib/format.js';
import { expenseCategories } from '../lib/constants.js';
import { DEFAULT_REMINDER, reminderText } from '../lib/reminder.js';
import { addDays, todayISO } from '../lib/dates.js';

export default function Settings() {
  const { state, dispatch, notify, startFresh, loadDemo, today, canLoadDemo, backendName } = useStore();
  const [name, setName] = useState(state.settings.gardenName);
  const [addr, setAddr] = useState(state.settings.gardenAddress || '');
  const [gphone, setGphone] = useState(state.settings.gardenPhone || '');

  return (
    <div className="page">
      <PageHead title="Settings" sub="Your garden's name, booking types, expense categories, seasons and backups." />
      <div className="stack">
        <section className="card">
          <div className="card-head"><h2>Garden</h2></div>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <Field label="Garden name"><input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ minWidth: 260 }} /></Field>
            <button className="btn" style={{ marginBottom: 12 }} disabled={!name.trim() || name.trim() === state.settings.gardenName} onClick={() => { dispatch({ type: 'setSettings', fields: { gardenName: name.trim() } }); notify('Name saved'); }}>Save</button>
          </div>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <Field label="Address on receipts"><input type="text" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Optional" style={{ minWidth: 260 }} /></Field>
            <Field label="Phone on receipts"><input type="text" value={gphone} onChange={(e) => setGphone(e.target.value)} placeholder="Optional" /></Field>
            <button className="btn" style={{ marginBottom: 12 }} disabled={addr.trim() === (state.settings.gardenAddress || '') && gphone.trim() === (state.settings.gardenPhone || '')} onClick={() => { dispatch({ type: 'setSettings', fields: { gardenAddress: addr.trim(), gardenPhone: gphone.trim() } }); notify('Receipt details saved'); }}>Save</button>
          </div>
        </section>
        <Reminder />
        <BookingTypes />
        <ExpenseCategories />
        <Seasons />
        <Data today={today} state={state} dispatch={dispatch} notify={notify} startFresh={startFresh} loadDemo={loadDemo} canLoadDemo={canLoadDemo} backendName={backendName} />
      </div>
    </div>
  );
}

function BookingTypes() {
  const { state, dispatch, notify } = useStore();
  const types = state.settings.eventTypes;
  const [adding, setAdding] = useState('');
  const [renaming, setRenaming] = useState(null);
  const [removing, setRemoving] = useState(null);
  const count = (t) => state.bookings.filter((b) => b.eventType === t).length;
  const exists = (n, except) => types.some((t) => t !== except && t.toLowerCase() === n.trim().toLowerCase());
  const addErr = adding.trim() && exists(adding) ? 'You already have this type.' : '';

  const add = () => {
    if (!adding.trim() || addErr) return;
    dispatch({ type: 'addEventType', name: adding });
    notify(`"${adding.trim()}" added`);
    setAdding('');
  };

  return (
    <section className="card">
      <div className="card-head">
        <div><h2>Booking types</h2><p>These appear when you add a booking. Add the kinds of events you host, and remove the ones you do not.</p></div>
      </div>
      <div className="list">
        {types.map((t) => (
          <div className="list-row" key={t}>
            {renaming?.from === t ? (
              <>
                <input type="text" value={renaming.to} onChange={(e) => setRenaming({ ...renaming, to: e.target.value })} aria-label={`New name for ${t}`} style={{ maxWidth: 260 }} autoFocus
                  onKeyDown={(e) => { if (e.key === 'Escape') setRenaming(null); }} />
                <button className="btn small primary" disabled={!renaming.to.trim() || exists(renaming.to, t)} onClick={() => { dispatch({ type: 'renameEventType', from: t, to: renaming.to }); notify('Renamed'); setRenaming(null); }}>Save</button>
                <button className="btn small" onClick={() => setRenaming(null)}>Close</button>
                {exists(renaming.to, t) && <span className="err small" style={{ color: 'var(--red)' }}>You already have this type.</span>}
              </>
            ) : (
              <>
                <div className="grow"><span className="t">{t}</span> <span className="small muted">· {plural(count(t), 'booking')}</span></div>
                <button className="btn small" onClick={() => setRenaming({ from: t, to: t })}>Rename</button>
                <button className="btn small danger" disabled={types.length <= 1} title={types.length <= 1 ? 'Keep at least one type' : undefined} onClick={() => setRemoving(t)}>Remove</button>
              </>
            )}
          </div>
        ))}
      </div>
      <hr className="sep" />
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <Field label="Add a booking type" error={addErr}>
          <input type="text" value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="For example Mehendi or Haldi" style={{ minWidth: 260 }} />
        </Field>
        <button className="btn primary" style={{ marginBottom: addErr ? 30 : 12 }} onClick={add} disabled={!adding.trim() || !!addErr}>Add type</button>
      </div>
      {removing && <RemoveType name={removing} onClose={() => setRemoving(null)} />}
    </section>
  );
}

function ExpenseCategories() {
  const { state, dispatch, notify } = useStore();
  const cats = expenseCategories(state.settings);
  const [adding, setAdding] = useState('');
  const [renaming, setRenaming] = useState(null);
  const [removing, setRemoving] = useState(null);
  const count = (c) => state.expenses.filter((e) => e.category === c).length;
  const bad = (n, except) => {
    const t = n.trim().toLowerCase();
    if (!t) return '';
    if (t === 'labour') return '"Labour" is worked out from attendance. Pick another name.';
    return cats.some((c) => c !== except && c.toLowerCase() === t) ? 'You already have this category.' : '';
  };
  const addErr = bad(adding);
  const add = () => {
    if (!adding.trim() || addErr) return;
    dispatch({ type: 'addExpenseCategory', name: adding });
    notify(`"${adding.trim()}" added`);
    setAdding('');
  };
  return (
    <section className="card">
      <div className="card-head">
        <div><h2>Expense categories</h2><p>The kinds of cost you pick when you add an expense, such as Painting or Repairs. Add your own, rename them, or remove the ones you do not use.</p></div>
      </div>
      <div className="list">
        {cats.map((c) => (
          <div className="list-row" key={c}>
            {renaming?.from === c ? (
              <>
                <input type="text" value={renaming.to} onChange={(e) => setRenaming({ ...renaming, to: e.target.value })} aria-label={`New name for ${c}`} style={{ maxWidth: 260 }} autoFocus
                  onKeyDown={(e) => { if (e.key === 'Escape') setRenaming(null); }} />
                <button className="btn small primary" disabled={!renaming.to.trim() || !!bad(renaming.to, c)} onClick={() => { dispatch({ type: 'renameExpenseCategory', from: c, to: renaming.to }); notify('Renamed'); setRenaming(null); }}>Save</button>
                <button className="btn small" onClick={() => setRenaming(null)}>Close</button>
                {bad(renaming.to, c) && <span className="small" style={{ color: 'var(--red)' }}>{bad(renaming.to, c)}</span>}
              </>
            ) : (
              <>
                <div className="grow"><span className="t">{c}</span> <span className="small muted">· {plural(count(c), 'expense')}</span></div>
                <button className="btn small" onClick={() => setRenaming({ from: c, to: c })}>Rename</button>
                <button className="btn small danger" disabled={cats.length <= 1} onClick={() => setRemoving(c)}>Remove</button>
              </>
            )}
          </div>
        ))}
      </div>
      <hr className="sep" />
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <Field label="Add a category" error={addErr}>
          <input type="text" value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="For example Generator fuel or Pest control" style={{ minWidth: 260 }} />
        </Field>
        <button className="btn primary" style={{ marginBottom: addErr ? 30 : 12 }} onClick={add} disabled={!adding.trim() || !!addErr}>Add category</button>
      </div>
      {removing && <RemoveCategory name={removing} cats={cats} onClose={() => setRemoving(null)} />}
    </section>
  );
}

function RemoveCategory({ name, cats, onClose }) {
  const { state, dispatch, notify } = useStore();
  const others = cats.filter((c) => c !== name);
  const used = state.expenses.filter((e) => e.category === name).length;
  const [to, setTo] = useState(others.includes('Other') ? 'Other' : others[0]);
  if (!used) {
    return (
      <Confirm title={`Remove "${name}"?`} confirmLabel="Remove category" danger onConfirm={() => { dispatch({ type: 'removeExpenseCategory', name }); notify(`"${name}" removed`); }} onClose={onClose}>
        <p>No expense uses this category, so nothing else changes.</p>
      </Confirm>
    );
  }
  return (
    <Modal
      title={`Remove "${name}"?`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Keep it</button>
          <button className="btn danger solid" onClick={() => { dispatch({ type: 'removeExpenseCategory', name, moveTo: to }); notify(`"${name}" removed. ${plural(used, 'expense')} moved to ${to}.`); onClose(); }}>Remove and move</button>
        </>
      }
    >
      <p style={{ marginBottom: 12 }}><b>{plural(used, 'expense')}</b> use this category. Choose the category they should have from now on. No amount is deleted.</p>
      <Field label="Move these expenses to">
        <select value={to} onChange={(e) => setTo(e.target.value)}>{others.map((c) => <option key={c}>{c}</option>)}</select>
      </Field>
    </Modal>
  );
}

function RemoveType({ name, onClose }) {
  const { state, dispatch, notify } = useStore();
  const others = state.settings.eventTypes.filter((t) => t !== name);
  const used = state.bookings.filter((b) => b.eventType === name).length;
  const [to, setTo] = useState(others.includes('Other') ? 'Other' : others[0]);
  if (!used) {
    return (
      <Confirm title={`Remove "${name}"?`} confirmLabel="Remove type" danger onConfirm={() => { dispatch({ type: 'removeEventType', name }); notify(`"${name}" removed`); }} onClose={onClose}>
        <p>No booking uses this type, so nothing else changes.</p>
      </Confirm>
    );
  }
  return (
    <Modal
      title={`Remove "${name}"?`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Keep it</button>
          <button className="btn danger solid" onClick={() => { dispatch({ type: 'removeEventType', name, moveTo: to }); notify(`"${name}" removed. ${plural(used, 'booking')} moved to ${to}.`); onClose(); }}>Remove and move</button>
        </>
      }
    >
      <p style={{ marginBottom: 12 }}><b>{plural(used, 'booking')}</b> use this type, including old events. Choose the type they should have from now on. No booking, price or payment is deleted.</p>
      <Field label="Move these bookings to">
        <select value={to} onChange={(e) => setTo(e.target.value)}>{others.map((t) => <option key={t}>{t}</option>)}</select>
      </Field>
    </Modal>
  );
}

function Seasons() {
  const { state, dispatch } = useStore();
  const seasons = state.settings.seasons;
  const owner = (m) => seasons.find((s) => s.months.includes(m))?.name;
  const toggle = (sName, m) => {
    const next = seasons.map((s) => {
      if (s.name === sName) return { ...s, months: s.months.includes(m) ? s.months.filter((x) => x !== m) : [...s.months, m].sort((a, b) => a - b) };
      return { ...s, months: s.months.filter((x) => x !== m) };
    });
    dispatch({ type: 'setSettings', fields: { seasons: next } });
  };
  const unassigned = MONTHS.map((_, i) => i + 1).filter((m) => !owner(m));
  return (
    <section className="card">
      <div className="card-head">
        <div><h2>Seasons</h2><p>Choose which months belong to each season. The revenue and expense graphs group your events this way, for every year.</p></div>
      </div>
      <div className="season-grid">
        {seasons.map((s) => (
          <div key={s.name}>
            <div className="small muted" style={{ marginBottom: 6, fontWeight: 500 }}>{s.name}</div>
            <div className="month-chips">
              {MONTHS.map((mn, i) => (
                <button key={mn} className="chip" aria-pressed={s.months.includes(i + 1)} onClick={() => toggle(s.name, i + 1)}>{mn}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {unassigned.length > 0 && <div className="note" style={{ marginTop: 12 }}>{unassigned.map((m) => MONTHS[m - 1]).join(', ')} {unassigned.length === 1 ? 'is' : 'are'} not in any season. Events in {unassigned.length === 1 ? 'that month' : 'those months'} show as "Unassigned" in the graphs.</div>}
    </section>
  );
}

function Data({ today, state, dispatch, notify, startFresh, loadDemo, canLoadDemo, backendName }) {
  const [ask, setAsk] = useState(null);
  const [err, setErr] = useState('');
  const counts = `${plural(state.bookings.length, 'booking')}, ${plural(state.payments.length, 'payment')}, ${plural(state.documents.length, 'document')}`;

  const [busy, setBusy] = useState(false);
  const backup = async () => {
    setBusy(true); setErr('');
    try {
      const { zip, files, missing } = await buildBackup(state);
      const url = URL.createObjectURL(zip);
      const a = document.createElement('a');
      a.href = url; a.download = `garden-backup-${today}.zip`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      notify(missing.length ? `Backup downloaded with ${plural(files, 'file')}. ${plural(missing.length, 'invoice file')} could not be found and ${missing.length === 1 ? 'is' : 'are'} not in it.` : `Backup downloaded, with ${plural(files, 'invoice file')}.`);
    } catch { setErr('The backup could not be made. Check your connection and try again.'); }
    setBusy(false);
  };
  const restore = async (file) => {
    setErr('');
    if (!file) return;
    try {
      const { state: s, files } = await readBackup(file);
      const ok = s && s.version === 1 && ['clients', 'bookings', 'payments', 'expenses', 'cancellations', 'staff', 'attendance', 'documents'].every((k) => Array.isArray(s[k])) && s.settings && Array.isArray(s.settings.eventTypes) && Array.isArray(s.settings.seasons);
      if (!ok) throw new Error('shape');
      setAsk({ kind: 'restore', state: s, files, name: file.name });
    } catch {
      setErr('This file is not a backup made by this app. Choose the .zip file you downloaded from here.');
    }
  };

  return (
    <section className="card">
      <div className="card-head"><div><h2>Your data</h2><p>Right now you have {counts}.</p></div></div>
      {backendName === 'browser' && <div className="note info" style={{ marginBottom: 14 }}>This prototype keeps everything in this browser only. Clearing the browser's site data would erase it, so download a backup now and then. The real version will keep it in your private cloud.</div>}
      <div className="row">
        <button className="btn" onClick={backup} disabled={busy}>{busy ? 'Preparing backup…' : 'Download a backup'}</button>
        <label className="btn" style={{ cursor: 'pointer' }}>
          Restore from a backup
          <input type="file" accept=".zip,.json,application/zip,application/json" hidden onChange={(e) => { restore(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>
      {err && <p className="err small" role="alert" style={{ color: 'var(--red)', marginTop: 8 }}>{err}</p>}
      <p className="small muted" style={{ marginTop: 8 }}>The backup is one .zip file holding all your records and every invoice file. Keep a copy somewhere other than this device, for example your email or a USB drive. Do it after any big day of entries.</p>
      <hr className="sep" />
      <h3 style={{ marginBottom: 8 }}>Demo data</h3>
      <p className="muted" style={{ marginBottom: 10 }}>The app starts with made-up clients and six years of invented events so you can try everything. When you are ready to use your own records, clear it.</p>
      <div className="row">
        <button className="btn danger" onClick={() => setAsk({ kind: 'fresh' })}>Clear everything and start fresh</button>
        {canLoadDemo && <button className="btn" onClick={() => setAsk({ kind: 'demo' })}>Load the demo data again</button>}
      </div>
      {ask?.kind === 'fresh' && (
        <Confirm title="Clear all records?" confirmLabel="Clear everything" danger onConfirm={() => { startFresh(); notify('Cleared. The app is empty and ready for your records.'); }} onClose={() => setAsk(null)}>
          <p>This removes all {counts}, and every client, expense, staff member and attendance record. Your booking types and seasons stay.</p>
          <p className="note">Download a backup first if you might want any of it back.</p>
        </Confirm>
      )}
      {ask?.kind === 'demo' && (
        <Confirm title="Replace your records with demo data?" confirmLabel="Replace with demo data" danger onConfirm={() => { loadDemo(); notify('Demo data loaded'); }} onClose={() => setAsk(null)}>
          <p>Everything you have now ({counts}) will be replaced by the made-up demo records.</p>
        </Confirm>
      )}
      {ask?.kind === 'restore' && (
        <Confirm title="Restore this backup?" confirmLabel="Restore" danger onConfirm={async () => { const failed = await restoreFiles(ask.state, ask.files); dispatch({ type: 'reset', state: { ...ask.state, role: state.role } }); notify(failed ? `Backup restored. ${plural(failed, 'invoice file')} could not be stored.` : 'Backup restored'); }} onClose={() => setAsk(null)}>
          <p><b>{ask.name}</b> holds {plural(ask.state.bookings.length, 'booking')} and {plural(ask.files.length, 'invoice file')}. It replaces everything you have now.</p>
        </Confirm>
      )}
    </section>
  );
}

function Reminder() {
  const { state, dispatch, notify } = useStore();
  const saved = state.settings.reminderText || DEFAULT_REMINDER;
  const [text, setText] = useState(saved);
  const sample = { client: { name: 'Sharma' }, booking: { date: addDays(todayISO(), 20) }, eventType: 'Wedding', pending: 12500000 };
  return (
    <section className="card">
      <div className="card-head"><div><h2>Payment reminder message</h2><p>The WhatsApp message sent from the "WhatsApp reminder" button on an event with money still due. You can change the words. Keep the parts in curly brackets: {'{name} {amount} {date} {event} {garden}'}.</p></div></div>
      <Field label="Message"><textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} style={{ width: '100%' }} /></Field>
      <p className="small muted" style={{ marginBottom: 10 }}><b>How it looks:</b> {reminderText(text, sample, state.settings.gardenName)}</p>
      <div className="row">
        <button className="btn" disabled={!text.trim() || text.trim() === saved} onClick={() => { dispatch({ type: 'setSettings', fields: { reminderText: text.trim() } }); notify('Reminder message saved'); }}>Save</button>
        <button className="btn" disabled={text === DEFAULT_REMINDER && !state.settings.reminderText} onClick={() => { setText(DEFAULT_REMINDER); dispatch({ type: 'setSettings', fields: { reminderText: '' } }); notify('Back to the standard message'); }}>Use the standard message</button>
      </div>
    </section>
  );
}
