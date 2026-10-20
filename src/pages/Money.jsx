import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { Empty, Kpi, PageHead, SortTh, sortRows } from '../components/ui.jsx';
import { totals } from '../lib/calc.js';
import { downloadText, toCSV } from '../lib/csv.js';
import { fmtDate, inr, inrShort, MONTHS_LONG, plural } from '../lib/format.js';
import { yearsIn } from '../lib/analytics.js';

/** Revenue and profit in one structured table: every event, with what it earned and what it cost. */
export default function Money() {
  const { data, today } = useStore();
  const years = useMemo(() => yearsIn(data), [data]);
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(years.includes(thisYear) ? thisYear : years[years.length - 1] ?? 'all');
  const [month, setMonth] = useState('all');
  const [cancel, setCancel] = useState(true);
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' });

  const inScope = (y, m) => (year === 'all' || y === Number(year)) && (month === 'all' || m === Number(month));
  const rows = useMemo(() => data.rows.filter((r) => r.counted && inScope(r.year, r.month)), [data.rows, year, month]);
  const cancelRows = useMemo(() => (cancel ? data.cancelRows.filter((c) => inScope(c.year, c.month)) : []), [data.cancelRows, year, month, cancel]);
  const overhead = useMemo(() => data.overheadRows.filter((o) => inScope(o.year, o.month)), [data.overheadRows, year, month]);
  const t = totals(rows, cancelRows, overhead);

  const lines = useMemo(() => [
    ...rows.map((r) => ({ id: r.id, kind: 'event', date: r.booking.date, client: r.client.name, type: r.eventType, revenue: r.revenue, received: r.collected, pending: r.pending, expenses: r.expenses, profit: r.profit })),
    ...cancelRows.map((c) => ({ id: `c${c.bookingId}`, link: c.bookingId, kind: 'cancel', date: c.date, client: c.client.name, type: 'Kept advance', revenue: c.amount, received: c.amount, pending: 0, expenses: 0, profit: c.amount })),
  ], [rows, cancelRows]);
  const sorted = useMemo(() => sortRows(lines, sort, {
    date: (l) => l.date, client: (l) => l.client.toLowerCase(), revenue: (l) => l.revenue, received: (l) => l.received, pending: (l) => l.pending, expenses: (l) => l.expenses, profit: (l) => l.profit,
  }), [lines, sort]);

  const exportCsv = () => {
    downloadText(
      `revenue-and-profit-${year}${month === 'all' ? '' : `-${month}`}.csv`,
      toCSV([
        ['Date', 'Client', 'Type', 'Revenue', 'Received', 'Still due', 'Expenses', 'Profit'],
        ...sorted.map((l) => [l.date, l.client, l.type, l.revenue / 100, l.received / 100, l.pending / 100, l.expenses / 100, l.profit / 100]),
        ...(t.overhead ? [[`${scope}`, 'Garden expenses (not tied to an event)', '', 0, 0, 0, t.overhead / 100, -t.overhead / 100]] : []),
        ['Total', '', '', t.total / 100, (t.collected + t.cancel) / 100, t.pending / 100, t.expenses / 100, t.profit / 100],
      ]),
    );
  };

  const scope = `${month === 'all' ? '' : `${MONTHS_LONG[month - 1]} `}${year === 'all' ? 'all years' : year}`;

  return (
    <div className="page">
      <PageHead title="Revenue and profit">
        <button className="btn" onClick={exportCsv} disabled={!sorted.length}>Download as spreadsheet</button>
      </PageHead>

      <div className="card" style={{ padding: '12px 16px', marginBottom: 16 }}>
        <div className="row fbar">
          <label className="small muted" htmlFor="m-year">Year</label>
          <select id="m-year" value={year} onChange={(e) => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))} style={{ width: 'auto' }}>
            <option value="all">All years</option>
            {[...years].reverse().map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <label className="small muted" htmlFor="m-month">Month</label>
          <select id="m-month" value={month} onChange={(e) => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))} style={{ width: 'auto' }}>
            <option value="all">Whole year</option>
            {MONTHS_LONG.map((mn, i) => <option key={mn} value={i + 1}>{mn}</option>)}
          </select>
          <label className="row small" style={{ gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={cancel} onChange={(e) => setCancel(e.target.checked)} />
            Include kept advances from cancelled bookings
          </label>
        </div>
      </div>

      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <Kpi accent label={`Total revenue, ${scope}`} value={inrShort(t.total)} sub={`${plural(t.events, 'event')}${cancel && t.cancel ? ` + ${inrShort(t.cancel)} kept advances` : ''}`} />
        <Kpi label="Expenses" value={inrShort(t.expenses)} sub={t.overhead ? `${inrShort(t.eventExpenses)} on events + ${inrShort(t.overhead)} garden costs` : 'Wages, decor, catering and the rest'} />
        <Kpi label="Profit" value={inrShort(t.profit)} tone={t.profit < 0 ? 'bad' : ''} sub={t.total > 0 ? `${Math.round((t.profit / t.total) * 100)}% of revenue` : ''} />
        <Kpi label="Received" value={inrShort(t.collected + t.cancel)} sub="Money in the bank for these events" />
        <Kpi label="Still to collect" value={inrShort(t.pending)} sub="Balance due on these events" />
        <Kpi label="Average per event" value={t.events ? inrShort(Math.round(t.revenue / t.events)) : '—'} sub="Agreed price, kept advances excluded" />
      </div>

      <div className="card" style={{ padding: 8 }}>
        {sorted.length === 0 ? (
          <Empty title="Nothing for this selection">Pick another year or month. Only confirmed and completed events count as revenue.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <SortTh label="Date" k="date" sort={sort} setSort={setSort} />
                  <SortTh label="Client" k="client" sort={sort} setSort={setSort} />
                  <SortTh label="Revenue" k="revenue" sort={sort} setSort={setSort} right />
                  <SortTh label="Received" k="received" sort={sort} setSort={setSort} right className="hide-sm" />
                  <SortTh label="Still due" k="pending" sort={sort} setSort={setSort} right className="hide-sm" />
                  <SortTh label="Expenses" k="expenses" sort={sort} setSort={setSort} right className="hide-sm" />
                  <SortTh label="Profit" k="profit" sort={sort} setSort={setSort} right />
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0, 300).map((l) => (
                  <tr key={l.id}>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>{fmtDate(l.date)}</td>
                    <td>
                      <Link to={`/events/${l.link || l.id}`}>{l.client}</Link>
                      <div className="small muted">{l.kind === 'cancel' ? 'Kept advance from a cancelled booking' : l.type}</div>
                    </td>
                    <td className="right num">{inr(l.revenue)}</td>
                    <td className="right num hide-sm">{inr(l.received)}</td>
                    <td className="right num hide-sm">{l.pending ? inr(l.pending) : <span className="faint">—</span>}</td>
                    <td className="right num hide-sm">{l.expenses ? inr(l.expenses) : <span className="faint">—</span>}</td>
                    <td className={`right num ${l.profit < 0 ? 'bad' : ''}`} style={{ fontWeight: 500 }}>{inr(l.profit)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {t.overhead > 0 && (
                  <tr>
                    <td colSpan={2} style={{ padding: '10px' }}><Link to="/costs">Garden expenses</Link><div className="small muted">Painting, repairs, yearly bills: not tied to one event</div></td>
                    <td className="right num"><span className="faint">—</span></td>
                    <td className="right num hide-sm"><span className="faint">—</span></td>
                    <td className="right num hide-sm"><span className="faint">—</span></td>
                    <td className="right num hide-sm">{inr(t.overhead)}</td>
                    <td className="right num bad" style={{ fontWeight: 500 }}>{inr(-t.overhead)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={2} style={{ fontWeight: 700, padding: '12px 10px' }}>Total</td>
                  <td className="right num" style={{ fontWeight: 700 }}>{inr(t.total)}</td>
                  <td className="right num hide-sm" style={{ fontWeight: 700 }}>{inr(t.collected + t.cancel)}</td>
                  <td className="right num hide-sm" style={{ fontWeight: 700 }}>{inr(t.pending)}</td>
                  <td className="right num hide-sm" style={{ fontWeight: 700 }}>{inr(t.expenses)}</td>
                  <td className={`right num ${t.profit < 0 ? 'bad' : ''}`} style={{ fontWeight: 700 }}>{inr(t.profit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {sorted.length > 300 && <p className="small muted" style={{ padding: 12 }}>Showing 300 of {sorted.length}. Pick a year to narrow it, or download the spreadsheet for everything.</p>}
      </div>
    </div>
  );
}
