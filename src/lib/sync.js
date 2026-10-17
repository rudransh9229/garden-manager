// The sync layer turns "the app's data changed" into small writes a backend can store,
// and turns writes from other devices back into data. The screens never talk to a backend.
//
// Data is a handful of lists (clients, bookings, ...) plus one settings object.
// A write is { op: 'set', collection, id, data } or { op: 'delete', collection, id }.
// If two devices change the same record, the later write wins. Different records never clash.

export const COLLECTIONS = ['clients', 'bookings', 'payments', 'expenses', 'cancellations', 'staff', 'attendance', 'documents'];
const KEY_FIELD = { cancellations: 'bookingId' }; // one cancellation per booking; everything else has an id
export const keyOf = (collection, item) => String(item[KEY_FIELD[collection] || 'id']);

export const emptyData = (settings = null) => ({
  version: 1,
  settings,
  clients: [], bookings: [], payments: [], expenses: [], cancellations: [], staff: [], attendance: [], documents: [],
});

const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** The writes needed to turn `prev` into `next`. Unchanged records produce nothing. */
export function diffState(prev, next) {
  const ops = [];
  for (const c of COLLECTIONS) {
    const a = prev[c];
    const b = next[c];
    if (a === b) continue;
    const before = new Map(a.map((x) => [keyOf(c, x), x]));
    const seen = new Set();
    for (const item of b) {
      const k = keyOf(c, item);
      seen.add(k);
      const old = before.get(k);
      if (old !== item && !(old && same(old, item))) ops.push({ op: 'set', collection: c, id: k, data: item });
    }
    for (const k of before.keys()) if (!seen.has(k)) ops.push({ op: 'delete', collection: c, id: k });
  }
  if (prev.settings !== next.settings && !same(prev.settings, next.settings)) {
    ops.push({ op: 'set', collection: 'settings', id: 'main', data: next.settings });
  }
  return ops;
}

/** The data after applying writes (from this device's queue, or arriving from another device). */
export function applyOps(state, ops) {
  if (!ops.length) return state;
  const out = { ...state };
  const byCollection = new Map();
  for (const o of ops) {
    if (!byCollection.has(o.collection)) byCollection.set(o.collection, []);
    byCollection.get(o.collection).push(o);
  }
  for (const [c, list] of byCollection) {
    if (c === 'settings') {
      for (const o of list) if (o.op === 'set') out.settings = o.data;
      continue;
    }
    if (!COLLECTIONS.includes(c)) continue;
    const map = new Map(out[c].map((x) => [keyOf(c, x), x]));
    for (const o of list) {
      if (o.op === 'set') map.set(o.id, o.data);
      else map.delete(o.id);
    }
    out[c] = [...map.values()];
  }
  return out;
}

/** Several writes to the same record collapse to the last one. */
export function coalesce(ops) {
  const m = new Map();
  for (const o of ops) {
    const k = `${o.collection}/${o.id}`;
    m.delete(k);
    m.set(k, o);
  }
  return [...m.values()];
}

/** True when two datasets hold the same records, whatever their order. */
export function sameData(a, b) {
  for (const c of COLLECTIONS) {
    if (a[c].length !== b[c].length) return false;
    const norm = (s) => [...s[c]].sort((x, y) => (keyOf(c, x) < keyOf(c, y) ? -1 : 1)).map((x) => JSON.stringify(x));
    const na = norm(a);
    const nb = norm(b);
    if (na.some((v, i) => v !== nb[i])) return false;
  }
  return same(a.settings, b.settings);
}
