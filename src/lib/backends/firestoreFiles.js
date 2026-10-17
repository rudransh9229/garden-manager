/**
 * Invoice files kept inside Firestore, so no extra paid service (or card) is needed.
 * A file is cut into pieces of 600 KB (Firestore documents hold at most 1 MB), each piece stored as text
 * in /fileParts/<id>_<n>, plus a small /files/<id> record that says how many pieces there are.
 * Both collections are owners-only in firestore.rules. Photos are shrunk before they get here (files.js).
 */
const PART = 600 * 1024;
export const ONLINE_FILE_LIMIT = 3 * 1024 * 1024;

const toBase64 = (bytes) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

export function createFirestoreFileStore({ db, fs }) {
  const meta = (id) => fs.doc(db, 'files', id);
  const part = (id, n) => fs.doc(db, 'fileParts', `${id}_${n}`);

  const store = {
    maxBytes: ONLINE_FILE_LIMIT,

    async put(id, blob) {
      const old = await fs.getDoc(meta(id));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const count = Math.max(1, Math.ceil(bytes.length / PART));
      const batch = fs.writeBatch(db);
      for (let n = 0; n < count; n++) batch.set(part(id, n), { data: toBase64(bytes.subarray(n * PART, (n + 1) * PART)) });
      const oldCount = old.exists() ? old.data().parts : 0;
      for (let n = count; n < oldCount; n++) batch.delete(part(id, n)); // a smaller replacement leaves no stray pieces
      batch.set(meta(id), { id, parts: count, size: bytes.length, mime: blob.type || 'application/octet-stream', at: Date.now() });
      await batch.commit(); // all pieces and the record are saved together, or not at all
    },

    async get(id) {
      const m = await fs.getDoc(meta(id));
      if (!m.exists()) return undefined;
      const { parts, mime } = m.data();
      const pieces = await Promise.all(Array.from({ length: parts }, (_, n) => fs.getDoc(part(id, n))));
      if (pieces.some((p) => !p.exists())) throw new Error('The file is incomplete');
      return new Blob(pieces.map((p) => fromBase64(p.data().data)), { type: mime });
    },

    /** Files saved more than a day ago (a fresh one may still be waiting for its invoice record to sync from another device). */
    async listIds() {
      const snap = await fs.getDocs(fs.collection(db, 'files'));
      return snap.docs.filter((d) => Date.now() - (d.data().at || 0) > 24 * 3600 * 1000).map((d) => d.id);
    },

    async delete(id) {
      const m = await fs.getDoc(meta(id));
      if (!m.exists()) return;
      const batch = fs.writeBatch(db);
      for (let n = 0; n < m.data().parts; n++) batch.delete(part(id, n));
      batch.delete(meta(id));
      await batch.commit();
    },
  };
  return store;
}
