// Which parts of the data the manager must never be able to read. This is the single list the online
// backend and the database rules are both built from. Money and private contact details live in separate
// "private" collections that only owners can read. Everything else stays in the ordinary collection.
//
// The rest of the app never sees this split: a booking in memory is still one object with its `total`.

export const SPLIT = {
  clients: { coll: 'clientPrivate', fields: ['phone', 'address'] },
  bookings: { coll: 'bookingPrivate', fields: ['total'] },
  staff: { coll: 'staffPrivate', fields: ['dailyWage'] },
  attendance: { coll: 'attendancePrivate', fields: ['wageApplied', 'wageFor'] },
};
export const PRIVATE_COLLECTIONS = Object.values(SPLIT).map((s) => s.coll);

/** Collections only owners can read or write at all. */
export const OWNER_ONLY = ['payments', 'expenses', 'cancellations', 'documents', 'bin', 'files', 'fileParts'];
/** What the manager can read, and of those, what they can also change (marking attendance, adding a staff name). */
export const MANAGER_READS = ['clients', 'bookings', 'staff', 'attendance', 'settings'];
export const MANAGER_WRITES = ['staff', 'attendance'];

/** What a manager's screens see in place of the hidden fields, so nothing shows "NaN" or crashes. */
export const MANAGER_DEFAULTS = {
  clients: { phone: '', address: '' },
  bookings: { total: 0 },
  staff: { dailyWage: 0 },
  attendance: { wageApplied: 0 },
};

/** One record -> the ordinary part and the private part (null when the record has no private values). */
export function splitRecord(collection, rec) {
  const spec = SPLIT[collection];
  if (!spec) return { pub: rec, priv: null };
  const pub = { ...rec };
  const priv = {};
  let any = false;
  for (const f of spec.fields) {
    if (f in pub) {
      if (pub[f] !== undefined) { priv[f] = pub[f]; any = true; }
      delete pub[f];
    }
  }
  return { pub, priv: any ? priv : null };
}

/** The ordinary part and private part back into one record. */
export function joinRecord(collection, pub, priv, role) {
  const joined = { ...pub, ...(priv || {}) };
  return role === 'owner' ? joined : { ...(MANAGER_DEFAULTS[collection] || {}), ...joined };
}
