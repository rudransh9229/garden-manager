// Invoice scans and other documents are kept in the browser's own database (IndexedDB).
// In the real product these go to private cloud storage; the screens call the same four functions.
const DB = 'garden-manager-files';
const STORE = 'files';

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no storage'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function run(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const out = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(out && 'result' in out ? out.result : undefined); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Where files live. The screens only call the functions below, so the store can be swapped (browser now, online next). */
const browserStore = {
  maxBytes: 8 * 1024 * 1024,
  put: (id, blob) => run('readwrite', (s) => s.put(blob, id)),
  get: (id) => run('readonly', (s) => s.get(id)),
  delete: (id) => run('readwrite', (s) => s.delete(id)),
  listIds: () => run('readonly', (s) => s.getAllKeys()),
};
let store = browserStore;
export const setFileStore = (next) => { store = next || browserStore; };
export const fileLimitMB = () => Math.round((store.maxBytes / 1048576) * 10) / 10;

export const putFile = (id, blob) => store.put(id, blob);
export const getFile = (id) => store.get(id);
export const deleteFile = (id) => store.delete(id);
export const listFileIds = async () => (store.listIds ? store.listIds() : []);

const IMAGE_EDGE = 1800; // longest side, in pixels. Plenty for reading an invoice.

function shrinkImage(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, IMAGE_EDGE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * k));
      canvas.height = Math.max(1, Math.round(img.height * k));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob && blob.size < file.size ? blob : null), 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/**
 * Gets a picked file ready to store: photos are shrunk (a phone photo of an invoice is often 5 MB and becomes
 * about 300 KB), PDFs are kept as they are. Throws an Error with a plain message if the file cannot be kept.
 * Returns { blob, name, type, size }.
 */
export async function prepareFile(file) {
  const isImage = /^image\//.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isImage && !isPdf) throw new Error('Use a PDF or a photo (JPG, PNG).');
  let out = { blob: file, name: file.name, type: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'), size: file.size };
  if (isImage) {
    const small = await shrinkImage(file);
    if (small) out = { blob: small, name: file.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg', type: 'image/jpeg', size: small.size };
  }
  if (out.size > store.maxBytes) {
    const mb = (out.size / 1048576).toFixed(1);
    throw new Error(`This file is ${mb} MB and the limit is ${fileLimitMB()} MB.${isPdf ? ' Try scanning at a lower quality, or take a photo of the page instead.' : ' Try a smaller photo.'}`);
  }
  return out;
}

/** Delete stored files that no document points to any more (for example after a booking was deleted and not undone). */
export async function purgeOrphans(keepIds) {
  try {
    const keep = new Set(keepIds);
    const ids = await listFileIds();
    await Promise.all((ids || []).filter((id) => !keep.has(id)).map((id) => deleteFile(id)));
  } catch { /* storage not available: nothing to clean */ }
}

export async function openStored(id, name) {
  const blob = await getFile(id);
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (!w) {
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}
