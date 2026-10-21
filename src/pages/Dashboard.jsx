import { budgetStatus } from '../lib/budget.js';
import NextUp from '../components/NextUp.jsx';
import ReminderButton from '../components/ReminderButton.jsx';
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { useUi } from '../uiContext.jsx';
import { Empty, Icon, Kpi, PageHead, StatusPill, TypeTag } from '../components/ui.jsx';
import { BarsChart, ChartCard } from '../components/Charts.jsx';
import { money } from './RevenueGraphs.jsx';
import { addDays, diffDays, parseISO } from '../lib/dates.js';
import { applyFilters, monthly } from '../lib/analytics.js';
import { totals } from '../lib/calc.js';
import { COLORS } from '../lib/constants.js';
import { fmtDate, fmtDateShort, inr, inrShort, MONTHS_LONG, plural } from '../lib/format.js';

export default function Dashboard() {
  const { data, state, today } = useStore();
  const ui = useUi();
  const { y, m } = parseISO(today);

  const stats = useMemo(() => {
    const all = applyFilters(data, { year: 'all', season: 'all', type: 'all', includeCancel: true });
    const thisMonth = totals(all.rows.filter((r) => r.year === y && r.month === m), all.cancelRows.filter((c) => c.year === y && c.month === m), all.overhead.filter((o) => o.year === y && o.month === m));
    const thisYear = totals(all.rows.filter((r) => r.year === y), all.cancelRows.filter((c) => c.year === y), all.overhead.filter((o) => o.year === y));
    const pending = data.rows.reduce((s, r) => s + r.pending, 0);
    const months = monthly(applyFilters(data, { year: y, season: 'all', type: 'all', includeCancel: true }), y);
    return { thisMonth, thisYear, pending, months };
  }, [data, y, m]);

  const upcoming = useMemo(
    () => data.rows.filter((r) => ['Confirmed', 'Tentative', 'Enquiry'].includes(r.booking.status) && r.booking.date >= today && r.booking.date <= addDays(today, 30))
      .sort((a, b) => (a.booking.date < b.booking.date ? -1 : 1)),
    [data.rows, today],
  );
  const recent = useMemo(
    () => [...state.payments].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 7)
      .map((p) => ({ p, row: data.rowById.get(p.bookingId) })).filter((x) => x.row),
    [state.payments, data.rowById],
  );
  const dues = useMemo(
    () => data.rows.filter((r) => r.counted && r.booking.date < today && r.pending > 0).sort((a, b) => b.pending - a.pending),
    [data.rows, today],
  );
  const overBudget = useMemo(() => budgetStatus(state.settings, data, today).filter((b) => b.over), [state.settings, data, today]);
  const duesTotal = dues.reduce((s, r) => s + r.pending, 0);

  const empty = state.bookings.length === 0;

  return (
    <div className="page">
      <PageHead title="Dashboard">
        <button className="btn primary" onClick={() => ui.newBooking()}><Icon name="plus" />New booking</button>
      </PageHead>

      {empty ? (
        <div className="card">
          <Empty title="Nothing here yet" action={<div className="row" style={{ justifyContent: 'center' }}><button className="btn primary" onClick={() => ui.newBooking()}>Add the first booking</button><Link className="btn" to="/import">Import old records</Link></div>}>
            Add a booking, or bring in your old records. Your revenue and upcoming events will show up here.
          </Empty>
        </div>
      ) : (
        <div className="stack">
          <NextUp upcoming={upcoming} today={today} onNewBooking={() => ui.newBooking()} />
          {overBudget.length > 0 && (
            <div className="note" role="status">
              Over budget this month: {overBudget.map((b) => `${b.name} (${inr(b.spent - b.budget)} over)`).join(', ')}. <Link to="/costs">See expenses</Link>
            </div>
          )}
          <div className="grid cols-4">
            <Kpi accent label={`Revenue in ${MONTHS_LONG[m - 1]}`} value={inrShort(stats.thisMonth.total)} sub={`${plural(stats.thisMonth.events, 'event')}${stats.thisMonth.cancel ? ` · ${inrShort(stats.thisMonth.cancel)} kept advances` : ''}`} />
            <Kpi label={`Revenue in ${y}`} value={inrShort(stats.thisYear.total)} sub={`${plural(stats.thisYear.events, 'event')}`} />
            <Kpi label={`Profit in ${y}`} value={inrShort(stats.thisYear.profit)} sub={`After ${inrShort(stats.thisYear.expenses)} expenses${stats.thisYear.overhead ? `, ${inrShort(stats.thisYear.overhead)} of it garden costs` : ''}`} tone={stats.thisYear.profit < 0 ? 'bad' : ''} />
            <Kpi label="Still to collect" value={inrShort(stats.pending)} sub="From confirmed and completed events" />
          </div>

          <div className="grid cols-2" style={{ alignItems: 'start' }}>
            <section className="card dash-up">
              <div className="card-head"><h2>Next 30 days</h2><Link to="/calendar" className="small">Open calendar</Link></div>
              {upcoming.length === 0 ? (
                <p className="muted">No events in the next 30 days.</p>
              ) : (
                <div className="list">
                  {upcoming.slice(0, 8).map((r) => {
                    const dd = diffDays(r.booking.date, today);
                    return (
                      <div className="list-row" key={r.id}>
                        <div style={{ width: 52, textAlign: 'center', lineHeight: 1.15 }}>
                          <div style={{ font: '700 20px var(--font-head)' }}>{r.day}</div>
                          <div className="small muted">{fmtDateShort(r.booking.date).split(' ')[1]}</div>
                        </div>
                        <div className="grow">
                          <div className="t ellipsis"><Link to={`/events/${r.id}`}>{r.client.name}</Link></div>
                          <div className="small muted"><TypeTag name={r.eventType} /> · {dd === 0 ? 'today' : dd === 1 ? 'tomorrow' : `in ${dd} days`}{r.counted && r.pending > 0 ? ` · ${inr(r.pending)} due` : ''}</div>
                        </div>
                        <StatusPill status={r.booking.status} />
                      </div>
                    );
                  })}
                  {upcoming.length > 8 && <p className="small muted" style={{ paddingTop: 10 }}>And {upcoming.length - 8} more. See the calendar.</p>}
                </div>
              )}
            </section>

            <section className="card dash-dues">
              <div className="card-head">
                <h2>Dues on past events</h2>
                {dues.length > 0 && <span className="small muted">{inr(duesTotal)} across {plural(dues.length, 'event')}</span>}
              </div>
              {dues.length === 0 ? (
                <p className="muted">Every past event is fully paid.</p>
              ) : (
                <div className="list">
                  {dues.slice(0, 6).map((r) => (
                    <div className="list-row" key={r.id}>
                      <div className="grow">
                        <div className="t ellipsis"><Link to={`/events/${r.id}`}>{r.client.name}</Link></div>
                        <div className="small muted">{fmtDate(r.booking.date)} · <TypeTag name={r.eventType} /></div>
                      </div>
                      <b className="num bad">{inr(r.pending)}</b>
                      <ReminderButton row={r} small />
                    </div>
                  ))}
                  {dues.length > 6 && <p className="small muted" style={{ paddingTop: 10 }}>And {dues.length - 6} more.</p>}
                </div>
              )}
            </section>
          </div>

          <div className="dash-chart"><ChartCard
            title={`Revenue by month, ${y}`}
            legend={[{ name: 'Event revenue', color: COLORS.revenue }, { name: 'Cancellation income', color: COLORS.cancel }]}
            columns={[{ key: 'label', label: 'Month' }, money('revenue', 'Event revenue'), money('cancel', 'Cancellation income'), money('total', 'Total')]}
            rows={stats.months}
            csvName={`revenue-${y}`}
          >
            <BarsChart data={stats.months} series={[{ key: 'revenue', name: 'Event revenue', color: COLORS.revenue }, { key: 'cancel', name: 'Cancellation income', color: COLORS.cancel }]} stacked height={250} />
          </ChartCard></div>

          <section className="card dash-pay">
            <div className="card-head"><h2>Latest payments</h2></div>
            {recent.length === 0 ? <p className="muted">No payments recorded yet.</p> : (
              <div className="list">
                {recent.map(({ p, row }) => (
                  <div className="list-row" key={p.id}>
                    <div className="grow">
                      <div className="t"><Link to={`/events/${row.id}`}>{row.client.name}</Link></div>
                      <div className="small muted">{fmtDate(p.date)} · {p.mode}{p.note ? ` · ${p.note}` : ''}</div>
                    </div>
                    <b className="num">{inr(p.amount)}</b>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
