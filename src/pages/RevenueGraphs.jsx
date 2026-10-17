import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { PageHead } from '../components/ui.jsx';
import { BarsChart, ChartCard, Empty0, LinesChart, yearColor } from '../components/Charts.jsx';
import { AnalyticsFilters, DrillPanel, Highlights } from '../components/AnalyticsBits.jsx';
import { COLORS } from '../lib/constants.js';
import { applyFilters, argmax, byMonthOfYear, byType, byYear, bySeasonYear, growth, monthly, yearOverYear, yearsIn } from '../lib/analytics.js';
import { fmtPct, inr, inrShort } from '../lib/format.js';

export const money = (key, label) => ({ key, label, fmt: inr, csv: (v) => Math.round((v || 0) / 100) });

export default function RevenueGraphs() {
  const { data, state, today } = useStore();
  const years = useMemo(() => yearsIn(data), [data]);
  const thisYear = Number(today.slice(0, 4));
  const [f, setF] = useState({ year: years.includes(thisYear) ? thisYear : years[years.length - 1] ?? 'all', season: 'all', type: 'all', includeCancel: true });
  const [drill, setDrill] = useState(null);
  const setFilters = (next) => { setF(next); setDrill(null); };

  const filtered = useMemo(() => applyFilters(data, f), [data, f]);
  const across = useMemo(() => applyFilters(data, f, { ignoreYear: true }), [data, f]);
  const months = useMemo(() => monthly(filtered, f.year), [filtered, f.year]);
  const sy = useMemo(() => bySeasonYear(across, state.settings), [across, state.settings]);
  const yoy = useMemo(() => yearOverYear(across, 'revenue'), [across]);
  const types = useMemo(() => byType(filtered).map((t) => ({ ...t, label: t.type })), [filtered]);
  const perYear = useMemo(() => byYear(across).map((y) => ({ ...y, label: String(y.year) })), [across]);
  const seasonsNow = useMemo(() => {
    const m = new Map(state.settings.seasons.map((s) => [s.name, { label: s.name, revenue: 0, cancel: 0, total: 0, _rows: [], _cancel: [] }]));
    const get = (n) => { if (!m.has(n)) m.set(n, { label: n, revenue: 0, cancel: 0, total: 0, _rows: [], _cancel: [] }); return m.get(n); };
    for (const r of filtered.rows) { const e = get(r.season); e.revenue += r.revenue; e._rows.push(r); }
    for (const c of filtered.cancelRows) { const e = get(c.season); e.cancel += c.amount; e._cancel.push(c); }
    const list = [...m.values()].filter((e) => e.label !== 'Unassigned' || e._rows.length || e._cancel.length);
    for (const e of list) e.total = e.revenue + e.cancel;
    return list;
  }, [filtered, state.settings.seasons]);

  const nothing = filtered.rows.length === 0 && filtered.cancelRows.length === 0;
  const bestSeason = argmax(seasonsNow, (s) => s.total);
  const monthTotals = useMemo(() => byMonthOfYear(filtered), [filtered]);
  const bestMonth = argmax(monthTotals, (m) => m.total);
  const busiest = argmax(monthTotals, (m) => m.events);
  const g = growth(data, f, 'total');
  const scope = f.year === 'all' ? 'across all years' : `in ${f.year}`;

  const pick = (title, b) => setDrill({ title, rows: b._rows || [], cancel: b._cancel || [] });
  const timeline = months.map((m) => ({ ...m, __k: m.key }));
  const revSeries = [{ key: 'revenue', name: 'Event revenue', color: COLORS.revenue }, ...(f.includeCancel ? [{ key: 'cancel', name: 'Cancellation income', color: COLORS.cancel }] : [])];

  return (
    <div className="page">
      <PageHead title="Revenue graphs" sub="See how your revenue moves by month, season and year. Click any bar to see the events behind it." />
      <AnalyticsFilters f={f} setF={setFilters} years={years} settings={state.settings} types={state.settings.eventTypes} yearNote="The season and year comparisons always show every year so you can compare them. The other charts follow the year you pick." />

      {nothing ? (
        <div className="card"><Empty0>No revenue matches these filters. Pick another year or season, or add bookings.</Empty0></div>
      ) : (
        <>
          <Highlights items={[
            { label: 'Best season', value: bestSeason && bestSeason.total ? bestSeason.label : '—', sub: bestSeason && bestSeason.total ? `${inrShort(bestSeason.total)} ${scope}` : '' },
            { label: 'Best month', value: bestMonth && bestMonth.total ? bestMonth.label : '—', sub: bestMonth && bestMonth.total ? `${inrShort(bestMonth.total)} ${scope}` : '' },
            { label: 'Busiest month', value: busiest && busiest.events ? busiest.label : '—', sub: busiest && busiest.events ? `${busiest.events} events ${scope}` : '' },
            { label: 'Growth', value: fmtPct(g.pct), sub: g.pct === null ? (g.label ? `No ${f.year === 'all' ? '' : 'earlier '}year to compare` : '') : g.label, tone: g.pct === null ? '' : g.pct >= 0 ? 'good' : 'bad' },
          ]} />

          <div className="stack">
            <ChartCard
              title={f.year === 'all' ? 'Revenue by month, all years' : `Revenue by month, ${f.year}`}
              sub="Event revenue is the agreed price of confirmed and completed bookings, in the month of the event."
              legend={revSeries}
              columns={[{ key: 'label', label: 'Month' }, money('revenue', 'Event revenue'), ...(f.includeCancel ? [money('cancel', 'Cancellation income')] : []), money('total', 'Total'), { key: 'events', label: 'Events' }]}
              rows={months}
              csvName="revenue-by-month"
            >
              <BarsChart data={timeline} series={revSeries} stacked onPick={(b) => pick(`${b.label}${f.year === 'all' ? '' : ` ${f.year}`}`, b)} height={290} />
              <p className="small muted" style={{ margin: '10px 0 2px' }}>Events per month</p>
              <BarsChart data={timeline} series={[{ key: 'events', name: 'Events', color: '#4b5a51' }]} fmt={(n) => String(n)} yFmt={(n) => n} height={110} onPick={(b) => pick(`${b.label}${f.year === 'all' ? '' : ` ${f.year}`}`, b)} />
            </ChartCard>

            <div className="grid cols-2">
              <ChartCard
                title="Seasons compared, year by year"
                sub="Revenue in each season, every year side by side. Darker means a more recent year."
                legend={sy.years.map((y) => ({ name: String(y), color: yearColor(sy.years, y) }))}
                columns={[{ key: 'label', label: 'Season' }, ...sy.years.map((y) => money(String(y), String(y)))]}
                rows={sy.seasons.map((s) => ({ label: s, ...Object.fromEntries(sy.years.map((y) => [String(y), sy.cell(s, y).total])) }))}
                csvName="revenue-season-by-year"
              >
                <BarsChart
                  data={sy.seasons.map((s) => ({ label: s, ...Object.fromEntries(sy.years.map((y) => [String(y), sy.cell(s, y).total])) }))}
                  series={sy.years.map((y) => ({ key: String(y), name: String(y), color: yearColor(sy.years, y) }))}
                  onPick={(row, s) => { const y = Number(s.key); const c = sy.cell(row.label, y); pick(`${row.label} ${y}`, c); }}
                  barSize={16}
                />
              </ChartCard>

              <ChartCard
                title="Same month, every year"
                sub="Each line is one year, so you can see whether a month is getting better."
                legend={yoy.years.map((y) => ({ name: String(y), color: yearColor(yoy.years, y) }))}
                columns={[{ key: 'label', label: 'Month' }, ...yoy.years.map((y) => money(String(y), String(y)))]}
                rows={yoy.data}
                csvName="revenue-same-month-every-year"
              >
                <LinesChart data={yoy.data} series={yoy.years.map((y) => ({ key: String(y), name: String(y), color: yearColor(yoy.years, y) }))} />
              </ChartCard>

              <ChartCard
                title="Revenue by booking type"
                sub={f.year === 'all' ? 'All years' : String(f.year)}
                columns={[{ key: 'label', label: 'Booking type' }, money('revenue', 'Event revenue'), ...(f.includeCancel ? [money('cancel', 'Cancellation income')] : []), money('total', 'Total'), { key: 'events', label: 'Events' }]}
                rows={types}
                csvName="revenue-by-booking-type"
              >
                <BarsChart data={types} series={[{ key: 'total', name: 'Revenue', color: COLORS.revenue }]} horizontal onPick={(b) => pick(b.label, b)} height={Math.max(200, types.length * 44 + 30)} />
              </ChartCard>

              <ChartCard
                title="Average price per event"
                sub="Agreed price divided by number of events, for each year."
                columns={[{ key: 'label', label: 'Year' }, money('avgPrice', 'Average price'), { key: 'events', label: 'Events' }]}
                rows={perYear}
                csvName="average-price-per-event"
              >
                <BarsChart data={perYear} series={[{ key: 'avgPrice', name: 'Average price', color: COLORS.revenue }]} />
              </ChartCard>

              <ChartCard
                title="Collected and still to collect"
                sub="Money received for each month's events, and what is still due."
                legend={[{ name: 'Collected', color: COLORS.revenue }, { name: 'Still due', color: COLORS.pending }]}
                columns={[{ key: 'label', label: 'Month' }, money('collected', 'Collected'), money('pending', 'Still due')]}
                rows={months}
                csvName="collected-and-due"
                note="Cancelled bookings never show as due."
              >
                <BarsChart data={timeline} series={[{ key: 'collected', name: 'Collected', color: COLORS.revenue }, { key: 'pending', name: 'Still due', color: COLORS.pending }]} stacked onPick={(b) => pick(`${b.label}${f.year === 'all' ? '' : ` ${f.year}`}`, b)} />
              </ChartCard>

              {f.includeCancel && (
                <ChartCard
                  title="Cancellation income by season"
                  sub="Advances you kept after a booking was cancelled."
                  columns={[{ key: 'label', label: 'Season' }, money('cancel', 'Kept advances')]}
                  rows={seasonsNow}
                  csvName="cancellation-income-by-season"
                >
                  {seasonsNow.some((s) => s.cancel > 0) ? (
                    <BarsChart data={seasonsNow} series={[{ key: 'cancel', name: 'Kept advances', color: COLORS.cancel }]} onPick={(b) => pick(`${b.label}: kept advances`, { _rows: [], _cancel: b._cancel })} />
                  ) : <Empty0>No kept advances in this selection.</Empty0>}
                </ChartCard>
              )}
            </div>
          </div>
          <DrillPanel drill={drill} onClose={() => setDrill(null)} />
        </>
      )}
    </div>
  );
}
