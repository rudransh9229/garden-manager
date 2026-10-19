import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Splash from './components/Splash.jsx';
import { reducer } from './lib/reducer.js';
import { computeAll } from './lib/calc.js';
import { buildSeed, emptyState } from './data/seed.js';
import { todayISO } from './lib/dates.js';
import { purgeOrphans } from './lib/files.js';
import { applyOps, diffState } from './lib/sync.js';
import { createWriteQueue } from './lib/writeQueue.js';

const Ctx = createContext(null);

/**
 * Holds the app's data. Where the data lives is the `backend`'s business (this browser today, Firebase next):
 *   - it is loaded once when the app opens,
 *   - every change is turned into small writes and saved in order, retried if the connection drops,
 *   - changes made on other devices arrive through backend.subscribe and appear on screen.
 */
export function StoreProvider({ backend, children }) {
  const [state, setState] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [sync, setSync] = useState({ status: 'saved', message: '' });
  const [toasts, setToasts] = useState([]);
  const today = todayISO();
  const stateRef = useRef(null);

  const commit = useCallback((next) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const queue = useMemo(
    () => createWriteQueue({
      write: (ops) => backend.write(ops),
      onStatus: (status, extra) => setSync({ status, message: extra.message || '' }),
    }),
    [backend],
  );

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const loaded = await backend.load();
      const role = loaded.role || loaded.state.role || 'owner';
      let next = { ...loaded.state, bin: loaded.state.bin || [], role };
      const owner = backend.name === 'browser' || (backend.name === 'firestore' && loaded.role === 'owner');
      if (owner) {
        // Bin entries older than 30 days are forgotten for good. Their invoice files go with them.
        const purged = reducer(next, { type: 'purgeBin', today: todayISO() });
        if (purged !== next) { queue.push(diffState(next, purged)); next = purged; }
      }
      commit(next);
      // Files whose invoice was deleted are cleared away (only day-old ones). A bin copy still counts as in use.
      if (owner) purgeOrphans([...next.documents, ...next.bin.flatMap((x) => x.snapshot?.documents || [])].map((d) => d.id));
    } catch (e) {
      setLoadError(String((e && e.message) || e));
    }
  }, [backend, commit, queue]);
  useEffect(() => { load(); }, [load]);

  const loaded = state !== null;
  useEffect(() => {
    if (!loaded || !backend.subscribe) return undefined;
    return backend.subscribe((ops) => commit(applyOps(stateRef.current, ops)));
  }, [loaded, backend, commit]);

  // Leaving with unsaved changes would lose them, so ask first.
  useEffect(() => {
    if (sync.status === 'saved') return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [sync.status]);
  useEffect(() => {
    const again = () => queue.retry();
    window.addEventListener('online', again);
    return () => window.removeEventListener('online', again);
  }, [queue]);

  // Online, the manager marks attendance without seeing wages; an owner's device works out the day's pay.
  const needsWages = state !== null && backend.name === 'firestore' && state.role === 'owner';
  useEffect(() => {
    if (needsWages) dispatch({ type: 'fixWages' });
  }, [state, needsWages]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = useMemo(() => (state ? computeAll(state) : null), [state]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback((message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-2), { id, message, undo: opts.undo }]);
    setTimeout(() => dismiss(id), opts.undo ? 9000 : 4000);
  }, [dismiss]);

  const dispatch = useCallback((action) => {
    const prev = stateRef.current;
    if (!prev) return;
    const next = reducer(prev, action);
    if (next === prev) return;
    commit(next);
    if (action.type === 'setRole' && backend.setRole) backend.setRole(next.role);
    queue.push(diffState(prev, next));
  }, [backend, commit, queue]);

  /** Runs a change and offers Undo, which puts the whole app back exactly as it was. */
  const act = useCallback((action, message) => {
    const before = stateRef.current;
    dispatch(action);
    notify(message, { undo: () => dispatch({ type: 'reset', state: before }) });
  }, [dispatch, notify]);

  const value = useMemo(() => ({
    state, data, dispatch, act, notify, today, toasts, dismiss,
    role: state?.role,
    isOwner: state?.role === 'owner',
    sync,
    retrySync: () => queue.retry(),
    backendName: backend.name,
    canSwitchRole: backend.canSwitchRole !== false, // with real accounts the role belongs to the account
    account: backend.account || '',
    people: backend.people || null, // only online, and only used on the People page (owners)
    uid: backend.uid || '',
    signOut: backend.signOut || null,
    canLoadDemo: backend.name === 'browser', // demo records must never be written into a real database
    startFresh: () => dispatch({ type: 'reset', state: { ...emptyState(stateRef.current.settings, today), role: stateRef.current.role } }),
    loadDemo: () => dispatch({ type: 'reset', state: { ...buildSeed(today), role: stateRef.current.role } }),
  }), [state, data, dispatch, act, notify, today, toasts, dismiss, sync, queue, backend]);

  if (!state && !loadError) return <Splash label="Loading your records" />;
  if (!state) {
    return (
      <div className="page">
        <div className="card">
          <h2>Your records could not be loaded</h2>
          {loadError && (
            <>
              <p className="muted" style={{ margin: '8px 0 12px' }}>Check your internet connection, then try again. Nothing was changed. ({loadError})</p>
              <button className="btn primary" onClick={load}>Try again</button>
            </>
          )}
        </div>
      </div>
    );
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
