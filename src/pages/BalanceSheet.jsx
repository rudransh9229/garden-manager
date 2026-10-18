import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { Empty, Kpi, PageHead } from '../components/ui.jsx';
import { buildStatement, periodRange, periodYears, statementWorkbook } from '../lib/balance.js';
import { LABOUR } from '../lib/constants.js';
import { parseISO } from '../lib/dates.js';
import { fmtDate, inr, inrShort, plural } from '../lib/format.js';

/** Income, expenses, profit and what is owed for one period, with a download as an Excel file. */
export default function BalanceSheet() {
  const { state, data, today, notify } = useStore();
  const years = useMemo(() => periodYears(data, today), [data, today]);
  const { y, m } = parseISO(today);
  const currentFy = m >= 4 ? y : y - 1;
  const [kind, setKind] = useState('fy');
  const [year, setYear] = useState(currentFy);
  const [busy, setBusy] = useState(false);

  const choices = kind === 'cy' ? years.cy : years.fy;
  const yearValue = choices.includes(year) ? year : choices[0];
  const period = useMemo(() => periodRange(kind, yearValue), [kind, yearValue]);
  const st = useMemo(() => buildStatement({ state, data, period, today }), [state, data, period, today]);
  const empty = st.events.length === 0 && st.kept.length === 0 && st.garden.length === 0;

  const download = async () => {
    setBusy(true);
    try {
      const blob = await statementWorkbook(st, state.settings.gardenName);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `balance-sheet-${period.label.replace(/[^A-Za-z0-9-]+/g, '-').toLowerCase()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      notify('Excel file downloaded');
    } catch (e) {
      notify(`Could not make the Excel file (${(e && e.message) || e})`);
    } finally {
      setBusy(false);
    }
  };

  const line = (label, value, { bold, note, tone } = {}) => (
    <tr>
      <td style={{ fontWeight: bold ? 700 : 400, padding: '8px 10px' }}>{label}{note && <div className="small muted" style={{ fontWeight: 400 }}>{note}</div>}</td>
      <td className={`right num ${tone || ''}`} style={{ fontWeight: bold ? 700 : 400 }}>{inr(value)}</td>
    </tr>
  );
  const head = (t) => <tr><th colSpan={2} style={{ background: 'var(--green-soft, #e3efe7)', textAlign: 'left', padding: '8px 10px' }}>{t}</th></tr>;

  return (
    <div className="page">
      <PageHead title="Balance sheet" sub="Income, expenses, profit and what is still owed, for a financial year, a calendar year or everything. Download it as an Excel file for your accountant or your records.">
        <button className="btn primary" onClick={download} disabled={busy || empty}>{busy ? 'Making the file…' : 'Download Excel file'}</button>
      </PageHead>

      <div className="card" style={{ padding: '12px 16px', marginBottom: 16 }}>
        <div className="row">
          <label className="small muted" htmlFor="b-kind">Period</label>
          <select id="b-kind" value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: 'auto' }}>
            <option value="fy">Financial year (April to March)</option>
            <option value="cy">Calendar year (January to December)</option>
            <option value="all">All years</option>
          </select>
          {kind !== 'all' && (
            <>
              <label className="small muted" htmlFor="b-year">{kind === 'fy' ? 'Financial year' : 'Year'}</label>
              <select id="b-year" value={yearValue} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 'auto' }}>
                {choices.map((v) => <option key={v} value={v}>{kind === 'fy' ? `${v}-${String(v + 1).slice(2)}` : v}</option>)}
              </select>
            </>
          )}
          <span className="small muted">{period.long}</span>
        </div>
      </div>

      {empty ? (
        <div className="card"><Empty title="Nothing in this period">No events, kept advances or expenses fall in {period.label}. Pick another period.</Empty></div>
      ) : (
        <>
          <div className="grid cols-4" style={{ marginBottom: 16 }}>
            <Kpi accent label="Total income" value={inrShort(st.income.total)} sub={`${plural(st.events.length, 'event')}${st.kept.length ? ` + ${plural(st.kept.length, 'kept advance')}` : ''}`} />
            <Kpi label="Total expenses" value={inrShort(st.expenses.total)} sub={`${inrShort(st.expenses.event)} on events, ${inrShort(st.expenses.garden)} garden`} />
            <Kpi label={st.profit < 0 ? 'Loss' : 'Profit'} value={inrShort(st.profit)} tone={st.profit < 0 ? 'bad' : ''} sub={st.income.total > 0 ? `${Math.round((st.profit / st.income.total) * 100)}% of income` : ''} />
            <Kpi label="Still owed to you" value={inrShort(st.toCollect - st.toPay)} sub={`${inrShort(st.toCollect)} to collect, ${inrShort(st.toPay)} bills to pay`} />
          </div>

          <div className="split-3-2">
            <section className="card" style={{ padding: 8 }}>
              <div className="table-wrap">
                <table>
                  <tbody>
                    {head('Income')}
                    {line('Event income', st.income.events, { note: 'Price of confirmed and completed events held in this period' })}
                    {st.kept.length > 0 && line('Advances kept from cancelled bookings', st.income.kept)}
                    {line('Total income', st.income.total, { bold: true })}
                    {head('Expenses')}
                    {st.categories.map((c) => line(c.name === LABOUR ? 'Staff wages' : c.name, c.total, { note: c.garden && c.event ? `${inr(c.event)} on events, ${inr(c.garden)} garden` : c.garden ? 'Garden expense' : c.name === LABOUR ? 'Worked out from attendance' : undefined }))}
                    {line('Total expenses', st.expenses.total, { bold: true })}
                    {head(st.profit < 0 ? 'Loss for the period' : 'Profit for the period')}
                    {line('Income minus expenses', st.profit, { bold: true, tone: st.profit < 0 ? 'bad' : '' })}
                    {head('What is owed')}
                    {line('Still to collect from clients', st.toCollect)}
                    {line('Bills still to pay', st.toPay)}
                    {head('Cash view')}
                    {line('Received from clients', st.receivedFromClients, { note: 'Everything paid so far for these events, plus kept advances' })}
                    {line('Expenses actually paid', st.paidOut)}
                    {line('Cash gained in the period', st.cashNet, { bold: true, tone: st.cashNet < 0 ? 'bad' : '' })}
                  </tbody>
                </table>
              </div>
              <p className="small muted" style={{ padding: '10px 12px' }}>This is a management statement worked out from your records, not an audited accounting balance sheet: the app does not hold bank balances, assets or loans. The Excel file has the same figures plus month by month, every event, garden expenses and what is owed.</p>
            </section>

            <div className="stack">
              <section className="card">
                <div className="card-head"><div><h2>Still to collect</h2><p>{plural(st.events.filter((r) => r.pending > 0).length, 'event')} with a balance</p></div></div>
                {st.toCollect === 0 ? <p className="muted small">Every event in this period is fully paid.</p> : (
                  <div className="list">
                    {st.events.filter((r) => r.pending > 0).sort((a, b) => b.pending - a.pending).slice(0, 8).map((r) => (
                      <div className="list-row" key={r.id}>
                        <div className="grow"><Link to={`/events/${r.id}`}>{r.client.name}</Link><div className="small muted">{fmtDate(r.booking.date)}</div></div>
                        <div className="num">{inr(r.pending)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section className="card">
                <div className="card-head"><div><h2>Bills still to pay</h2><p>Marked "not paid yet" on the <Link to="/costs">Expenses page</Link></p></div></div>
                {st.bills.length === 0 ? <p className="muted small">Nothing waiting to be paid.</p> : (
                  <div className="list">
                    {st.bills.slice(0, 8).map((b, i) => (
                      <div className="list-row" key={i}>
                        <div className="grow">{b.vendor || b.category}<div className="small muted">{fmtDate(b.date)} · {b.category}</div></div>
                        <div className="num">{inr(b.amount)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
