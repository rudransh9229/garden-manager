// A tiny pretend Firestore for the checks: documents in collections, live snapshots, write batches,
// and the "hasPendingWrites" flag Firestore puts on a device's own writes.
export function createFakeFirestore() {
  const store = new Map(); // collection -> Map(id -> data)
  const listeners = new Map(); // collection -> Set({ db, next })
  const col = (n) => { if (!store.has(n)) store.set(n, new Map()); return store.get(n); };
  const snapshot = (n, changes = []) => ({
    docs: [...col(n)].map(([id, d]) => ({ id, data: () => JSON.parse(JSON.stringify(d)), metadata: { hasPendingWrites: false } })),
    docChanges: () => changes,
  });
  const fs = {
    collection: (db, name) => ({ name }),
    doc: (db, name, id) => ({ name, id }),
    async getDocs(ref) { return snapshot(ref.name); },
    async getDoc(ref) { const d = col(ref.name).get(ref.id); return { exists: () => d !== undefined, data: () => d }; },
    onSnapshot(ref, a, b, c) {
      const [next, error] = typeof a === 'function' ? [a, b] : [b, c]; // (ref, options, next, error) also accepted
      const db = fs.__db;
      if (db.canRead && !db.canRead(ref.name)) { Promise.resolve().then(() => error && error({ code: 'permission-denied' })); return () => {}; }
      db.touched.push(ref.name);
      const l = { db, next };
      if (!listeners.has(ref.name)) listeners.set(ref.name, new Set());
      listeners.get(ref.name).add(l);
      Promise.resolve().then(() => next(snapshot(ref.name)));
      return () => listeners.get(ref.name).delete(l);
    },
    writeBatch(db) {
      const pending = [];
      return {
        set: (ref, data) => pending.push({ type: 'set', ref, data }),
        delete: (ref) => pending.push({ type: 'delete', ref }),
        async commit() {
          if (db.offline) throw new Error('offline');
          if (db.canWrite) for (const p of pending) if (!db.canWrite(p.ref.name)) throw Object.assign(new Error('permission denied'), { code: 'permission-denied' });
          const byCol = new Map();
          for (const p of pending) {
            const c = col(p.ref.name);
            if (p.type === 'set') { c.set(p.ref.id, JSON.parse(JSON.stringify(p.data))); }
            else c.delete(p.ref.id);
            if (!byCol.has(p.ref.name)) byCol.set(p.ref.name, []);
            byCol.get(p.ref.name).push(p);
          }
          for (const [name, list] of byCol) {
            for (const l of listeners.get(name) || []) {
              const mine = l.db === db;
              const changes = list.map((p) => ({
                type: p.type === 'delete' ? 'removed' : 'modified',
                doc: { id: p.ref.id, data: () => JSON.parse(JSON.stringify(p.data)), metadata: { hasPendingWrites: mine } },
              }));
              l.next(snapshot(name, changes));
            }
          }
        },
      };
    },
  };
  // each "device" gets its own db handle so the fake can tell whose write is whose
  return {
    store,
    /** Pretends the server re-confirmed a document without changing it (what includeMetadataChanges reports). */
    confirm(name, id) {
      for (const l of listeners.get(name) || []) {
        const d = col(name).get(id);
        l.next(snapshot(name, [{ type: 'modified', doc: { id, data: () => JSON.parse(JSON.stringify(d)), metadata: { hasPendingWrites: false } } }]));
      }
    },
    seed(name, id, data) { col(name).set(id, JSON.parse(JSON.stringify(data))); },
    device({ canRead, canWrite } = {}) {
      const db = { offline: false, canRead, canWrite, touched: [] };
      const mine = { ...fs, onSnapshot: (ref, n, e) => { fs.__db = db; return fs.onSnapshot(ref, n, e); } };
      return { db, fs: mine };
    },
  };
}
