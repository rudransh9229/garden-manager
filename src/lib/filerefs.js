// Every stored file the records point to: invoice scans and expense bills (photos or PDFs). Deleted bookings
// waiting in the bin still count. Backups, clean-up and restore all go through this one list.

/** The key an expense bill is stored under. */
export const billFileId = (expense) => `bill-${expense.id}`;

/** [{ id, name, mime }] for every record that says it has a file. */
export function fileRefs(state) {
  const docs = [...state.documents, ...(state.bin || []).flatMap((x) => x.snapshot?.documents || [])];
  const expenses = [...state.expenses, ...(state.bin || []).flatMap((x) => x.snapshot?.expenses || [])];
  return [
    ...docs.filter((d) => d.hasFile).map((d) => ({ id: d.id, name: d.name, mime: d.mime })),
    ...expenses.filter((e) => e.hasBill).map((e) => ({ id: billFileId(e), name: e.billName || 'bill', mime: e.billMime })),
  ];
}

/** Ids that must not be cleaned away. Documents without a file are kept too, since they may get one attached. */
export function keepIds(state) {
  return [...fileRefs(state).map((r) => r.id), ...state.documents.map((d) => d.id), ...(state.bin || []).flatMap((x) => (x.snapshot?.documents || []).map((d) => d.id))];
}
