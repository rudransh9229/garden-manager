import React, { useCallback, useEffect, useState } from 'react';
import { useStore } from '../store.jsx';
import { Confirm, Field, PageHead } from '../components/ui.jsx';
import { makePassword } from '../lib/backends/people.js';

const WHY = {
  'auth/email-already-in-use': 'That email already has a sign-in account. Add its role in the Firebase console instead (FIREBASE_SETUP.md, section 4), or use a different email.',
  'auth/operation-not-allowed': 'Firebase has sign-up switched off. In the Firebase console open Authentication, Settings, User actions, and turn on "Enable create (sign-up)". Then try again.',
  'auth/weak-password': 'The password needs at least 6 characters.',
  'auth/invalid-email': 'That does not look like an email address.',
  'auth/network-request-failed': 'Cannot reach the internet. Check your connection.',
  'permission-denied': 'The database refused this. Publish the latest firestore.rules in the Firebase console (Firestore Database, Rules).',
};
const say = (e) => WHY[e.code] || (e.code && e.code.startsWith('people/') ? e.message : 'That did not work. Check your connection and try again.');
const ROLE_LABEL = { owner: 'Owner (family)', manager: 'Manager' };

export default function People() {
  const { people, uid, account, notify } = useStore();
  const [list, setList] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('manager');
  const [password, setPassword] = useState(() => makePassword());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [created, setCreated] = useState(null);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async () => {
    setLoadErr('');
    try { setList(await people.list()); } catch (e) { setLoadErr(say(e)); }
  }, [people]);
  useEffect(() => { load(); }, [load]);

  const add = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(''); setCreated(null);
    try {
      const made = await people.add({ email, password, role });
      setCreated({ email: made.email, password, role });
      setEmail(''); setPassword(makePassword());
      await load();
    } catch (x) { setErr(say(x)); }
    setBusy(false);
  };
  const change = async (p, next) => {
    try { await people.setRole(p.uid, next); notify('Role changed'); await load(); } catch (x) { notify(say(x)); }
  };
  const remove = async () => {
    const p = removing;
    try { await people.removeAccess(p.uid); notify('Access removed'); await load(); } catch (x) { notify(say(x)); }
  };
  const reset = async (p) => {
    try { await people.resetPassword(p.email); notify(`A password reset email was sent to ${p.email}`); } catch (x) { notify(say(x)); }
  };
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); notify('Copied'); } catch { notify('Select the text and copy it.'); }
  };
  const address = window.location.href.split('#')[0];

  return (
    <>
      <PageHead title="People and sign-in" sub="Who can open this app, and as what. This is different from the Staff page, which lists the people who work at events." />

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="card-head"><div><h2>Add a person</h2><p>They get their own email and password. Owners see everything. Managers see bookings, staff and attendance, and no money.</p></div></div>
        <form onSubmit={add}>
          <div className="form-grid">
            <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" /></Field>
            <Field label="Role">
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="manager">Manager</option>
                <option value="owner">Owner (family)</option>
              </select>
            </Field>
            <Field label="Password" hint="Give this to them. They can change it later with Forgot password on the sign-in screen." full>
              <div className="row" style={{ gap: 8 }}>
                <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" style={{ flex: 1 }} />
                <button type="button" className="btn" onClick={() => setPassword(makePassword())}>New password</button>
              </div>
            </Field>
          </div>
          {err && <div className="note bad" role="alert" style={{ marginBottom: 12 }}>{err}</div>}
          <button className="btn primary" disabled={busy}>{busy ? 'Adding…' : 'Add person'}</button>
        </form>
        {created && (
          <div className="note good" style={{ marginTop: 14 }} role="status">
            <b>{created.email} can now sign in.</b> Send them this now. The password is not shown again.
            <pre style={{ whiteSpace: 'pre-wrap', margin: '8px 0', font: 'inherit' }}>{`Open: ${address}\nEmail: ${created.email}\nPassword: ${created.password}`}</pre>
            <button className="btn small" onClick={() => copy(`Open: ${address}\nEmail: ${created.email}\nPassword: ${created.password}`)}>Copy this message</button>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head"><div><h2>Everyone with access</h2></div></div>
        {loadErr && <div className="note bad" role="alert">{loadErr} <button className="btn small" onClick={load}>Try again</button></div>}
        {!list && !loadErr && <p className="muted">Loading…</p>}
        {list && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Person</th><th>Role</th><th aria-label="Actions" /></tr></thead>
              <tbody>
                {list.map((p) => {
                  const me = p.uid === uid;
                  const label = me ? (account || p.email) : (p.email || `No email saved (${p.uid.slice(0, 6)}…)`);
                  return (
                    <tr key={p.uid}>
                      <td>{label}{me && <span className="small muted"> · you</span>}</td>
                      <td>
                        {me ? ROLE_LABEL[p.role] : (
                          <select value={p.role} onChange={(e) => change(p, e.target.value)} aria-label={`Role for ${label}`}>
                            <option value="owner">Owner (family)</option>
                            <option value="manager">Manager</option>
                          </select>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {p.email && <button className="btn small" onClick={() => reset(p)}>Send password reset</button>}{' '}
                        {!me && <button className="btn small danger" onClick={() => setRemoving(p)}>Remove access</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="small muted" style={{ marginTop: 10 }}>Removing access stops a person from seeing anything. Their sign-in account stays in Firebase and can be deleted there if you want it gone completely.</p>
      </section>

      {removing && (
        <Confirm title="Remove access?" confirmLabel="Remove access" danger onConfirm={remove} onClose={() => setRemoving(null)}>
          <p><b>{removing.email || removing.uid}</b> will no longer be able to see anything in the app. You can add them again later.</p>
        </Confirm>
      )}
    </>
  );
}
