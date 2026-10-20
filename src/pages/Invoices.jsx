import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { useUi } from '../uiContext.jsx';
import { Empty, Icon, PageHead } from '../components/ui.jsx';
import DocFileActions from '../components/DocFileActions.jsx';
import { searchRows } from '../lib/search.js';
import { fmtDate, plural } from '../lib/format.js';

/** Invoices kept on file, grouped by the year of the event, plus the completed events that have none yet. */
export default function Invoices() {
  const { data, state, today } = useStore();
  const ui = useUi();
  const [q, setQ] = useState('');
  const [year, setYear] = useState('all');
  const [view, setView] = useState('onfile');
  const thisYear = Number(today.slice(0, 4));

  const extra = useMemo(() => {
    const m = new Map();
    for (const d of state.documents) m.set(d.bookingId, `${m.get(d.bookingId) || ''} ${d.number || ''}`);
    return m;
  }, [state.documents]);
  const matching = useMemo(() => (q.trim() ? new Set(searchRows(data.rows, q, extra).map((r) => r.id)) : null), [data.rows, q, extra]);

  const invoices = useMemo(
    () => state.documents.filter((d) => d.type === 'Invoice').map((d) => ({ doc: d, row: data.rowById.get(d.bookingId) })).filter((x) => x.row),
    [state.documents, data.rowById],
  );
  const years = useMemo(() => [...new Set(invoices.map((x) => x.row.year))].sort((a, b) => b - a), [invoices]);
  const shown = invoices.filter((x) => (year === 'all' || x.row.year === Number(year)) && (!matching || matching.has(x.row.id)));
  const byYear = useMemo(() => {
    const m = new Map();
    for (const x of shown) { if (!m.has(x.row.year)) m.set(x.row.year, []); m.get(x.row.year).push(x); }
    return [...m.entries()].sort((a, b) => b[0] - a[0]).map(([y, list]) => [y, list.sort((a, b) => (a.row.booking.date < b.row.booking.date ? 1 : -1))]);
  }, [shown]);

  const withInvoice = new Set(invoices.map((x) => x.row.id));
  const missing = useMemo(
    () => data.rows.filter((r) => r.booking.status === 'Completed' && !withInvoice.has(r.id) && (!matching || matching.has(r.id)) && (year === 'all' || r.year === Number(year)))
      .sort((a, b) => (a.booking.date < b.booking.date ? 1 : -1)),
    [data.rows, invoices, matching, year],
  );
  const missingAll = data.rows.filter((r) => r.booking.status === 'Completed' && !withInvoice.has(r.id)).length;

  return (
    <div className="page">
      <PageHead title="Invoices">
        <button className="btn primary" onClick={() => ui.addInvoice()}><Icon name="plus" />Add invoice</button>
      </PageHead>

      <div className="row between" style={{ marginBottom: 14 }}>
        <div className="seg" role="group" aria-label="Invoice view">
          <button aria-pressed={view === 'onfile'} onClick={() => setView('onfile')}>On file ({invoices.length})</button>
          <button aria-pressed={view === 'missing'} onClick={() => setView('missing')}>Not added yet ({missingAll})</button>
        </div>
        <div className="row">
          <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year" style={{ width: 'auto' }}>
            <option value="all">All years</option>
            {[...new Set([...years, ...data.rows.map((r) => r.year)])].sort((a, b) => b - a).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Invoice number, client or date" aria-label="Search invoices" style={{ width: 260 }} />
        </div>
      </div>

      {view === 'onfile' ? (
        invoices.length === 0 ? (
          <div className="card"><Empty title="No invoices on file yet" action={<button className="btn primary" onClick={() => ui.addInvoice()}>Add the first invoice</button>}>Add the scan or photo of an old invoice and it stays with that event.</Empty></div>
        ) : byYear.length === 0 ? (
          <div className="card"><Empty title="No invoice found">Check the spelling, or try the date like 4 Nov 2023.</Empty></div>
        ) : (
          byYear.map(([y, list]) => (
            <section className="card" key={y} style={{ marginBottom: 16 }}>
              <div className="year-head">
                <h2>{y}</h2>
                <span className="muted small">{plural(list.length, 'invoice')}{y < thisYear ? ' · previous year' : ' · this year'}</span>
              </div>
              <div className="table-wrap">
                <table className="inv-sm">
                  <thead>
                    <tr><th>Invoice</th><th>Client</th><th className="hide-sm">Event date</th><th className="right">File</th></tr>
                  </thead>
                  <tbody>
                    {list.map(({ doc, row }) => (
                      <tr key={doc.id}>
                        <td className="num" style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{doc.number || doc.name}</td>
                        <td><Link to={`/events/${row.id}`} style={{ textUnderlineOffset: 3 }}>{row.client.name}</Link><div className="small muted">{row.eventType}</div></td>
                        <td className="num hide-sm">{fmtDate(row.booking.date)}</td>
                        <td><DocFileActions doc={doc} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )
      ) : (
        <section className="card">
          <div className="card-head">
            <h2>Completed events without an invoice</h2>
            <p>{plural(missing.length, 'event')}. Add each old invoice here so the whole record is in one place.</p>
          </div>
          {missing.length === 0 ? (
            <Empty title="Nothing missing">{missingAll === 0 ? 'Every completed event has an invoice on file.' : 'No event without an invoice matches this search.'}</Empty>
          ) : (
            <div className="list">
              {missing.slice(0, 60).map((r) => (
                <div className="list-row" key={r.id}>
                  <div className="grow">
                    <div className="t"><Link to={`/events/${r.id}`}>{r.client.name}</Link></div>
                    <div className="small muted">{fmtDate(r.booking.date)} · {r.eventType}</div>
                  </div>
                  <button className="btn small" onClick={() => ui.addInvoice(r.id)}>Add invoice</button>
                </div>
              ))}
              {missing.length > 60 && <p className="small muted" style={{ paddingTop: 10 }}>Showing the newest 60. Use the year filter to see older ones.</p>}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
