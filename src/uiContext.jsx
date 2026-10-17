import React, { createContext, useContext, useMemo, useState } from 'react';
import BookingForm from './components/BookingForm.jsx';
import CancelDialog from './components/CancelDialog.jsx';
import InvoiceForm from './components/InvoiceForm.jsx';
import { useStore } from './store.jsx';

const Ctx = createContext(null);

/** One place that opens the booking, invoice and cancel windows, so any page can call them. */
export function UiProvider({ children }) {
  const { data } = useStore();
  const [m, setM] = useState(null);
  const api = useMemo(() => ({
    newBooking: (date) => setM({ kind: 'booking', date }),
    editBooking: (row) => setM({ kind: 'booking', row }),
    addInvoice: (eventId, type) => setM({ kind: 'invoice', eventId, type }),
    cancelBooking: (row) => setM({ kind: 'cancel', rowId: row.id }),
  }), []);
  const close = () => setM(null);
  const cancelRow = m?.kind === 'cancel' ? data.rowById.get(m.rowId) : null;
  return (
    <Ctx.Provider value={api}>
      {children}
      {m?.kind === 'booking' && <BookingForm row={m.row || null} defaultDate={m.date} onClose={close} />}
      {m?.kind === 'invoice' && <InvoiceForm eventId={m.eventId || ''} defaultType={m.type || 'Invoice'} onClose={close} />}
      {cancelRow && <CancelDialog row={cancelRow} onClose={close} />}
    </Ctx.Provider>
  );
}
export const useUi = () => useContext(Ctx);
