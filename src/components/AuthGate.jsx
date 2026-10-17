import React, { useEffect, useMemo, useState } from 'react';

/**
 * Shows the sign-in screen until a family member is signed in AND has been given a role.
 * Renders children(backend) once everything is ready.
 */
export default function AuthGate({ firebase, children }) {
  const [user, setUser] = useState(undefined); // undefined = still checking
  const [role, setRole] = useState('');
  const [problem, setProblem] = useState('');

  useEffect(() => firebase.onUser((u) => { setUser(u || null); setRole(''); setProblem(''); }), [firebase]);

  const backend = useMemo(() => {
    if (!user) return null;
    const b = firebase.backendFor(user.uid);
    b.signOut = async () => { await firebase.signOut(); window.location.reload(); };
    b.account = user.email;
    return b;
  }, [user, firebase]);

  useEffect(() => {
    if (!backend) return undefined;
    let live = true;
    backend.getRole().then((r) => live && setRole(r)).catch((e) => live && setProblem(e.code === 'NO_ACCESS' ? 'NO_ACCESS' : String(e.message || e)));
    return () => { live = false; };
  }, [backend]);

  if (user === undefined) return <Shell><p className="muted">Checking who you are…</p></Shell>;
  if (!user) return <SignIn firebase={firebase} />;
  if (problem === 'NO_ACCESS') {
    return (
      <Shell>
        <h2>You are signed in, but have no access yet</h2>
        <p className="muted" style={{ margin: '8px 0 14px' }}>
          Ask the owner to give <b>{user.email}</b> a role (owner or manager) in the Firebase console, then sign in again.
        </p>
        <button className="btn" onClick={() => firebase.signOut()}>Sign out</button>
      </Shell>
    );
  }
  if (problem) {
    return (
      <Shell>
        <h2>Could not check your access</h2>
        <p className="muted" style={{ margin: '8px 0 14px' }}>Check your internet connection and try again. ({problem})</p>
        <button className="btn primary" onClick={() => window.location.reload()}>Try again</button>
      </Shell>
    );
  }
  if (!role) return <Shell><p className="muted">Opening your records…</p></Shell>;
  return children(backend);
}

function Shell({ children }) {
  return (
    <div className="page" style={{ maxWidth: 440, margin: '8vh auto 0' }}>
      <div className="card">{children}</div>
    </div>
  );
}

const WHY = {
  'auth/invalid-credential': 'That email or password is not right.',
  'auth/invalid-email': 'That does not look like an email address.',
  'auth/too-many-requests': 'Too many tries. Wait a few minutes, or reset your password.',
  'auth/network-request-failed': 'Cannot reach the internet. Check your connection.',
};

function SignIn({ firebase }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ kind: '', text: '' });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg({ kind: '', text: '' });
    try { await firebase.signIn(email, password); }
    catch (err) { setMsg({ kind: 'error', text: WHY[err.code] || 'Could not sign in. Try again.' }); }
    setBusy(false);
  };
  const reset = async () => {
    if (!email.trim()) { setMsg({ kind: 'error', text: 'Type your email above first, then press this again.' }); return; }
    try { await firebase.resetPassword(email); } catch { /* same message either way, so nobody can test which emails exist */ }
    setMsg({ kind: 'ok', text: 'If that email has an account, a reset link is on its way.' });
  };

  return (
    <Shell>
      <h2>Garden Manager</h2>
      <p className="muted" style={{ margin: '4px 0 16px' }}>Private to the family and the garden manager. Sign in to continue.</p>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="si-email">Email</label>
          <input id="si-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="si-pass">Password</label>
          <input id="si-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {msg.text && <div className={`note ${msg.kind === 'error' ? 'bad' : 'good'}`} role="alert" style={{ marginBottom: 12 }}>{msg.text}</div>}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <button type="button" className="btn" onClick={reset}>Forgot password</button>
        </div>
      </form>
    </Shell>
  );
}
