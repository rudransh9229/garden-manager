import { getFile, putFile } from './files.js';
import { makeZip, readZip } from './zip.js';

const safe = (s) => String(s || 'file').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);

/** Everything in one .zip: records.json plus every invoice file (files/<document id>/<name>). */
export async function buildBackup(state) {
  const entries = [{ name: 'records.json', data: new TextEncoder().encode(JSON.stringify(state, null, 2)) }];
  const missing = [];
  for (const d of state.documents) {
    if (!d.hasFile) continue;
    let blob;
    try { blob = await getFile(d.id); } catch { blob = null; }
    if (!blob) { missing.push(d.name); continue; }
    entries.push({ name: `files/${safe(d.id)}/${safe(d.name)}`, data: blob });
  }
  return { zip: await makeZip(entries), files: entries.length - 1, missing };
}

/** Reads a backup (.zip, or the older records-only .json). Returns { state, files: [{ id, bytes, name }] }. */
export async function readBackup(file) {
  if (/\.json$/i.test(file.name)) return { state: JSON.parse(await file.text()), files: [] };
  const entries = await readZip(file);
  const rec = entries.find((e) => e.name === 'records.json');
  if (!rec) throw new Error('no records');
  const files = entries
    .filter((e) => e.name.startsWith('files/'))
    .map((e) => { const [, id, ...rest] = e.name.split('/'); return { id, name: rest.join('/'), bytes: e.data }; });
  return { state: JSON.parse(new TextDecoder().decode(rec.data)), files };
}

/** Puts the backup's files back into the file store. Returns how many could not be stored. */
export async function restoreFiles(state, files) {
  let failed = 0;
  const mime = new Map(state.documents.map((d) => [d.id, d.mime]));
  for (const f of files) {
    try { await putFile(f.id, new Blob([f.bytes], { type: mime.get(f.id) || '' })); } catch { failed += 1; }
  }
  return failed;
}
