import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { Confirm, Empty, PageHead } from '../components/ui.jsx';
import { BIN_DAYS } from '../lib/reducer.js';
import { diffDays } from '../lib/dates.js';
import { fmtDate, inr, plural } from '../lib/format.js';

/** Bookings that were deleted. They wait here for 30 days and can be put back with everything they had. */
export default function Bin() {
  const { state, act, today } = useStore();
  const [ask, setAsk] = useState(null); // { kind: 'forget' | 'empty', item }
  const items = [...(state.bin || [])].sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1));
  const daysLeft = (x) => (x.deletedAt ? Math.max(0, BIN_DAYS - diffDays(today, x.deletedAt)) : BIN_DAYS);
  const received = (x) => x.snapshot.payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="page">
      <PageHead title="Bin" sub={`A booking you delete waits here for ${BIN_DAYS} days, with its payments, expenses, attendance and invoices. Put it back any time before then.`}>
        {items.length > 1 && <button className="btn danger" onClick={() => setAsk({ kind: 'empty' })}>Empty the bin</button>}
      </PageHead>
      {items.length === 0 ? (
        <div className="card"><Empty title="The bin is empty">Bookings you delete from an event page will show up here.</Empty></div>
      ) : (
        <section className="card">
          <div className="list">
            {items.map((x) => (
              <div className="list-row" key={x.id} style={{ flexWrap: 'wrap' }}>
                <div className="grow" style={{ flexBasis: 240 }}>
                  <b>{x.name || 'Unnamed client'}</b>
                  <div className="small muted">
                    {fmtDate(x.date)}{x.eventType ? ` · ${x.eventType}` : ''} · {x.snapshot.booking.total ? `${inr(x.snapshot.booking.total)} price, ` : ''}{plural(x.snapshot.payments.length, 'payment')} ({inr(received(x))}) · {plural(x.snapshot.documents.length, 'invoice')}
                  </div>
                  <div className="small muted">Deleted {x.deletedAt ? fmtDate(x.deletedAt) : 'earlier'} · gone for good in {plural(daysLeft(x), 'day')}</div>
                </div>
                <button className="btn primary small" onClick={() => act({ type: 'restoreDeleted', id: x.id }, `Booking for ${x.name || 'the client'} put back`)}>Put back</button>
                <button className="btn small" onClick={() => setAsk({ kind: 'forget', item: x })}>Delete for good</button>
              </div>
            ))}
          </div>
        </section>
      )}
      {ask?.kind === 'forget' && (
        <Confirm title="Delete for good?" confirmLabel="Delete for good" danger onClose={() => setAsk(null)} onConfirm={() => act({ type: 'purgeBin', id: ask.item.id }, 'Deleted for good')}>
          <p>The booking for <b>{ask.item.name || 'this client'}</b> on {fmtDate(ask.item.date)} and all its payments and invoices will be removed. You will only be able to undo this right now.</p>
        </Confirm>
      )}
      {ask?.kind === 'empty' && (
        <Confirm title="Empty the bin?" confirmLabel="Empty the bin" danger onClose={() => setAsk(null)} onConfirm={() => act({ type: 'purgeBin' }, 'Bin emptied')}>
          <p>{plural(items.length, 'booking')} will be removed for good with their payments and invoices.</p>
        </Confirm>
      )}
    </div>
  );
}
