import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { fmtDate, fmtPhone, inr } from '../lib/format.js';
import { paiseInWords } from '../lib/words.js';

/** A one-page payment receipt to print or save as a PDF from the browser's print window. */
export default function Receipt() {
  const { paymentId } = useParams();
  const { state, data } = useStore();
  const p = state.payments.find((x) => x.id === paymentId);
  const row = p && data.rows.find((r) => r.id === p.bookingId);
  if (!p || !row) {
    return (
      <div className="page"><div className="card empty"><h3>This receipt is not here</h3><p>The payment may have been removed.</p><Link to="/events" className="btn">Back to events</Link></div></div>
    );
  }
  const s = state.settings;
  const all = state.payments.filter((x) => x.bookingId === p.bookingId).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const upTo = all.slice(0, all.indexOf(p) + 1).reduce((t, x) => t + x.amount, 0);
  const total = row.booking.total || 0;
  const balance = Math.max(0, total - upTo);
  const number = `R-${p.date.replace(/-/g, '')}-${String(p.id).slice(-4).toUpperCase()}`;

  return (
    <div className="page receipt-page">
      <div className="receipt-bar">
        <Link to={`/events/${row.id}`} className="back">← Back to the event</Link>
        <button className="btn primary" onClick={() => window.print()}>Print or save as PDF</button>
      </div>
      <article className="receipt" aria-label={`Receipt ${number}`}>
        <header className="receipt-head">
          <h1>{s.gardenName}</h1>
          {s.gardenAddress && <p>{s.gardenAddress}</p>}
          {s.gardenPhone && <p>Phone: {s.gardenPhone}</p>}
        </header>
        <h2 className="receipt-title">Payment receipt</h2>
        <div className="receipt-meta"><span>Receipt no. <b>{number}</b></span><span>Date <b>{fmtDate(p.date)}</b></span></div>
        <dl className="receipt-grid">
          <dt>Received from</dt><dd>{row.client.name}{row.client.phone ? ` (${fmtPhone(row.client.phone)})` : ''}</dd>
          <dt>For</dt><dd>{row.eventType} on {fmtDate(row.booking.date)}</dd>
          <dt>Amount</dt><dd className="receipt-amt">{inr(p.amount)}</dd>
          <dt>In words</dt><dd>{paiseInWords(p.amount)}</dd>
          <dt>Paid by</dt><dd>{p.mode}{p.note ? ` · ${p.note}` : ''}</dd>
          {total > 0 && (<><dt>Event price</dt><dd>{inr(total)}</dd><dt>Paid so far</dt><dd>{inr(upTo)}</dd><dt>Balance</dt><dd><b>{inr(balance)}</b></dd></>)}
        </dl>
        <footer className="receipt-foot">
          <p>Thank you.</p>
          <div className="receipt-sign">Authorised signature</div>
        </footer>
      </article>
    </div>
  );
}
