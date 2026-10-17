import { COLLECTIONS } from '../sync.js';
import { defaultSettings, emptyState } from '../../data/seed.js';
import { MANAGER_READS, PRIVATE_COLLECTIONS, SPLIT, joinRecord, splitRecord } from '../split.js';

/**
 * The real online backend: Google Firestore (free Spark plan).
 *
 * Layout: one small Firestore document per record at /<collection>/<id>, settings at /settings/main.
 * Money and private contact details are stored apart, in /clientPrivate, /bookingPrivate, /staffPrivate and
 * /attendancePrivate (see split.js). The database rules (firestore.rules) let only owners read those, so a
 * manager's phone never even receives them. The role comes from /users/<uid>, which only the owner creates.
 *
 * The Firestore functions are passed in (`fs`), so the checks can run this exact code against a pretend
 * Firestore. See firebase.js for the real wiring.
 *
 * Contract (same as the other backends): getRole(), load(), write(ops), subscribe(onOps), close().
 */
const BATCH = 200; // two documents per record at most, and Firestore allows 500 writes per batch
const LOAD_TIMEOUT_MS = 15000;
const same = (a, b) => a !== undefined && JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
const sortKeys = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeys(o[k])])) : o);
const BASE_OF = Object.fromEntries(Object.entries(SPLIT).map(([base, s]) => [s.coll, base]));

export function createFirestoreBackend({ db, fs, uid, today = '', loadTimeoutMs = LOAD_TIMEOUT_MS }) {
  let role = null;
  let stops = [];
  let listener = null;
  const waiting = []; // changes from other devices that arrived before the app started listening
  const pub = {}; // collection -> Map(id -> ordinary part)
  const priv = {}; // base collection -> Map(id -> private part)
  const cache = (store, c) => (store[c] || (store[c] = new Map()));

  const deliver = (ops) => {
    if (!ops.length) return;
    if (listener) listener(ops); else waiting.push(...ops);
  };
  const joined = (c, id) => {
    const p = cache(pub, c).get(id);
    return p ? joinRecord(c, p, SPLIT[c] ? cache(priv, c).get(id) : null, role) : null;
  };
  const watched = () => (role === 'owner' ? [...COLLECTIONS, 'settings', ...PRIVATE_COLLECTIONS] : MANAGER_READS);

  return {
    name: 'firestore',
    canSwitchRole: false,

    /** 'owner' or 'manager'. Throws NO_ACCESS when this account has not been given a role yet. */
    async getRole() {
      const snap = await fs.getDoc(fs.doc(db, 'users', uid));
      const r = snap.exists() ? snap.data().role : null;
      if (r !== 'owner' && r !== 'manager') throw Object.assign(new Error('NO_ACCESS'), { code: 'NO_ACCESS' });
      role = r;
      return r;
    },

    async load() {
      this.close(); // a retry starts clean
      await this.getRole();
      for (const store of [pub, priv]) for (const k of Object.keys(store)) delete store[k];
      let timer;
      const ready = Promise.all(watched().map((name) => new Promise((resolve, reject) => {
        let first = true;
        const stop = fs.onSnapshot(
          fs.collection(db, name),
          // Without this, a collection that is empty (or unchanged) and already remembered on this device never
          // reports "now confirmed by the server", and loading would wait forever.
          { includeMetadataChanges: true },
          (snap) => {
            const base = BASE_OF[name];
            const c = base || name;
            if (first) {
              // Offline, Firestore answers from an EMPTY local copy. That must never look like "all records are gone",
              // so an empty answer from the local copy is not trusted: wait for the real one.
              if (snap.metadata && snap.metadata.fromCache && snap.docs.length === 0) return;
              first = false;
              snap.docs.forEach((d) => (base ? cache(priv, c) : cache(pub, c)).set(d.id, d.data()));
              resolve();
              return;
            }
            const ops = [];
            snap.docChanges().forEach((ch) => {
              if (ch.doc.metadata && ch.doc.metadata.hasPendingWrites) return; // our own write echoing back
              const id = ch.doc.id;
              const removed = ch.type === 'removed';
              // Metadata-only events ("the server confirmed it") carry the same data we already hold: ignore those.
              if (base) {
                const mine = cache(priv, c);
                if (removed ? !mine.has(id) : same(mine.get(id), ch.doc.data())) return;
                if (removed) mine.delete(id); else mine.set(id, ch.doc.data());
                const j = joined(c, id);
                if (j) ops.push({ op: 'set', collection: c, id, data: j });
              } else if (removed) {
                if (!cache(pub, c).has(id)) return;
                cache(pub, c).delete(id);
                ops.push({ op: 'delete', collection: c, id });
              } else {
                if (same(cache(pub, c).get(id), ch.doc.data())) return;
                cache(pub, c).set(id, ch.doc.data());
                ops.push({ op: 'set', collection: c, id, data: joined(c, id) });
              }
            });
            deliver(ops);
          },
          (err) => { if (first) { first = false; reject(err); } },
        );
        stops.push(stop);
      })));
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Cannot reach the database right now')), loadTimeoutMs); });
      try { await Promise.race([ready, timeout]); } finally { clearTimeout(timer); }

      const state = emptyState(defaultSettings(), today);
      for (const c of COLLECTIONS) {
        state[c] = [...cache(pub, c).keys()].map((id) => joined(c, id));
      }
      const main = cache(pub, 'settings').get('main');
      if (main) state.settings = main;
      return { state: { ...state, role }, role };
    },

    async write(ops) {
      const owner = role === 'owner';
      const jobs = []; // each job is one Firestore write
      for (const o of ops) {
        const id = String(o.id);
        if (o.collection === 'settings') {
          jobs.push(o.op === 'delete' ? { del: ['settings', id] } : { set: ['settings', id, o.data] });
          cache(pub, 'settings')[o.op === 'delete' ? 'delete' : 'set'](id, o.data);
          continue;
        }
        const spec = SPLIT[o.collection];
        if (o.op === 'delete') {
          jobs.push({ del: [o.collection, id] });
          cache(pub, o.collection).delete(id);
          if (spec && owner) { jobs.push({ del: [spec.coll, id] }); cache(priv, o.collection).delete(id); }
          continue;
        }
        const { pub: p, priv: q } = splitRecord(o.collection, o.data);
        // Only write the part that actually changed: fewer writes, and other devices hear one change, not two.
        if (!same(cache(pub, o.collection).get(id), p)) jobs.push({ set: [o.collection, id, p] });
        cache(pub, o.collection).set(id, p);
        if (spec && owner && q) {
          if (!same(cache(priv, o.collection).get(id), q)) jobs.push({ set: [spec.coll, id, q] });
          cache(priv, o.collection).set(id, q);
        }
      }
      for (let i = 0; i < jobs.length; i += BATCH) {
        const batch = fs.writeBatch(db);
        for (const j of jobs.slice(i, i + BATCH)) {
          if (j.del) batch.delete(fs.doc(db, ...j.del)); else batch.set(fs.doc(db, j.set[0], j.set[1]), j.set[2]);
        }
        await batch.commit();
      }
    },

    subscribe(fn) {
      listener = fn;
      if (waiting.length) fn(waiting.splice(0));
      return () => { listener = null; };
    },

    close() { stops.forEach((s) => s()); stops = []; },
  };
}
