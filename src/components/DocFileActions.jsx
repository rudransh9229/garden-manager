import React, { useRef, useState } from 'react';
import { useStore } from '../store.jsx';
import { Confirm } from './ui.jsx';
import { deleteFile, openStored, prepareFile, putFile } from '../lib/files.js';

/** Open, attach a missing file, or delete one document. */
export default function DocFileActions({ doc }) {
  const { dispatch, notify } = useStore();
  const [askDelete, setAskDelete] = useState(false);
  const input = useRef(null);

  const open = async () => {
    try {
      if (!(await openStored(doc.id, doc.name))) notify('The file was not found.');
    } catch { notify('The file could not be opened. Check your connection.'); }
  };
  const attach = async (f) => {
    if (!f) return;
    try {
      const p = await prepareFile(f);
      await putFile(doc.id, p.blob);
      dispatch({ type: 'updateDocument', id: doc.id, fields: { hasFile: true, name: p.name, size: p.size, mime: p.type, demo: false } });
      notify('File attached');
    } catch (e) { notify(e.message && /MB|PDF or a photo/.test(e.message) ? e.message : 'The file could not be saved. Check your connection and try again.'); }
  };
  const remove = async () => {
    try { await deleteFile(doc.id); } catch { /* nothing stored */ }
    dispatch({ type: 'deleteDocument', id: doc.id });
    notify('Removed');
  };

  return (
    <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
      {doc.hasFile ? (
        <button className="btn small" onClick={open}>Open file</button>
      ) : (
        <>
          <span className="small faint">{doc.demo ? 'Sample entry, no scan' : 'No file yet'}</span>
          <button className="btn small" onClick={() => input.current?.click()}>Attach file</button>
          <input ref={input} type="file" accept="application/pdf,image/*" hidden onChange={(e) => { attach(e.target.files?.[0]); e.target.value = ''; }} />
        </>
      )}
      <button className="btn small danger" onClick={() => setAskDelete(true)} aria-label={`Delete ${doc.number || doc.name}`}>Delete</button>
      {askDelete && (
        <Confirm title="Delete this document?" confirmLabel="Delete" danger onConfirm={remove} onClose={() => setAskDelete(false)}>
          <p><b>{doc.number || doc.name}</b> will be removed{doc.hasFile ? ', along with its file' : ''}. This cannot be undone.</p>
        </Confirm>
      )}
    </div>
  );
}
