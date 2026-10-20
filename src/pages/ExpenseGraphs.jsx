import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { PageHead } from '../components/ui.jsx';
import { BarsAndLine, BarsChart, ChartCard, Donut, Empty0, yearColor } from '../components/Charts.jsx';
import { AnalyticsFilters, DrillPanel, Highlights } from '../components/AnalyticsBits.jsx';
import { money } from './RevenueGraphs.jsx';
import { COLORS, catColor } from '../lib/constants.js';
import { applyFilters, argmax, bySeasonYear, growth, monthly, yearsIn } from '../lib/analytics.js';
import { fmtPct, inr, inrShort } from '../lib/format.js';

export default function ExpenseGraphs() {
  const { data, state, today } = useStore();
  const years = useMemo(() => yearsIn(data), [data]);
  const thisYear = Number(today.slice(0, 4));
  const [f, setF] = useState({ year: years.includes(thisYear) ? thisYear : years[years.length - 1] ?? 'all', season: 'all', type: 'all', includeCancel: true });
  const [drill, setDrill] = useState(null);
  const setFilters = (next) => { setF(next); setDrill(null); };

  const filtered = useMemo(() => applyFilters(data, f), [data, f]);
  const across = useMemo(() => applyFilters(data, f, { ignoreYear: true }), [data, f]);
  const cats = data.categories;
  const months = useMemo(() => monthly(filtered, f.year, cats), [filtered, f.year, cats]);
  const sy = useMemo(() => bySeasonYear(across, state.settings), [across, state.settings]);

  const catTotals = useMemo(() => {
    const t = cats.map((c) => ({ name: c, value: months.reduce((s, m) => s + (m[c] || 0), 0), color: catColor(c, cats) }));
    return t;
  }, [months, cats]);
  const totalExp = catTotals.reduce((s, c) => s + c.value, 0);
  const rowsWithExpense = filtered.rows.filter((r) => r.expenses > 0).length;
  const nothing = totalExp === 0;
  const overheadTotal = months.reduce((s, m) => s + m.overhead, 0);
  const topCat = argmax(catTotals, (c) => c.value);
  const priciest = argmax(months, (m) => m.expenses);
  const g = growth(data, f, 'expenses');
  const scope = f.year === 'all' ? 'across all years' : `in ${f.year}`;
  const yrLabel = (b) => `${b.label}${f.year === 'all' ? '' : ` ${f.year}`}`;
  const pick = (title, b) => setDrill({ title, rows: (b._rows || []).filter((r) => r.expenses > 0), cancel: [], overhead: b._overhead || [] });

  const catSeries = cats.map((c) => ({ key: c, name: c, color: catColor(c, cats) }));
  const profitMonths = months.map((m) => ({ ...m, revenueAll: m.total }));

  return (
    <div className="page">
      <PageHead title="Expense graphs" />
      <AnalyticsFilters f={f} setF={setFilters} years={years} settings={state.settings} types={state.settings.eventTypes} />

      {nothing ? (
        <div className="card"><Empty0>No expenses for this selection.</Empty0></div>
      ) : (
        <>
          <Highlights items={[
            { label: 'Biggest cost', value: topCat && topCat.value ? topCat.name : '—', sub: topCat && topCat.value ? `${inrShort(topCat.value)} · ${Math.round((topCat.value / totalExp) * 100)}% of expenses` : '' },
            { label: 'Most expensive month', value: priciest && priciest.expenses ? priciest.label : '—', sub: priciest && priciest.expenses ? `${inrShort(priciest.expenses)} ${scope}` : '' },
            { label: 'Total expenses', value: inrShort(totalExp), sub: `${rowsWithExpense} events${overheadTotal ? ` + ${inrShort(overheadTotal)} garden costs` : ''} ${scope}` },
            { label: 'Change in expenses', value: fmtPct(g.pct), sub: g.pct === null ? 'No earlier year to compare' : g.label, tone: g.pct === null ? '' : g.pct <= 0 ? 'good' : 'bad' },
          ]} />

          <div className="stack">
            <ChartCard
              title={f.year === 'all' ? 'Expenses by month, all years' : `Expenses by month, ${f.year}`}
              legend={catSeries}
              columns={[{ key: 'label', label: 'Month' }, ...cats.map((c) => money(c, c)), money('expenses', 'Total')]}
              rows={months}
              csvName="expenses-kind-by-month"
            >
              <BarsChart data={months} series={catSeries} stacked onPick={(b) => pick(yrLabel(b), b)} height={300} />
            </ChartCard>

            <div className="grid cols-2">
              <ChartCard
                title="Where the money goes"
                columns={[{ key: 'name', label: 'Kind of cost' }, money('value', 'Amount'), { key: 'pct', label: 'Share', fmt: (v) => `${v}%` }]}
                rows={catTotals.map((c) => ({ ...c, pct: totalExp ? Math.round((c.value / totalExp) * 100) : 0 }))}
                csvName="expenses-by-kind"
              >
                <Donut data={catTotals.filter((c) => c.value > 0)} total={inrShort(totalExp)} />
                <table style={{ marginTop: 6 }}>
                  <tbody>
                    {catTotals.map((c) => (
                      <tr key={c.name}>
                        <td><i className="legend sw" style={{ display: 'inline-block', width: 11, height: 11, borderRadius: 3, background: c.color, marginRight: 8 }} />{c.name}</td>
                        <td className="right num">{inr(c.value)}</td>
                        <td className="right num muted">{totalExp ? Math.round((c.value / totalExp) * 100) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ChartCard>

              <ChartCard
                title="Seasons compared, year by year"
                legend={sy.years.map((y) => ({ name: String(y), color: yearColor(sy.years, y, COLORS.yearsExp) }))}
                columns={[{ key: 'label', label: 'Season' }, ...sy.years.map((y) => money(String(y), String(y)))]}
                rows={sy.seasons.map((s) => ({ label: s, ...Object.fromEntries(sy.years.map((y) => [String(y), sy.cell(s, y).expenses])) }))}
                csvName="expenses-season-by-year"
              >
                <BarsChart
                  data={sy.seasons.map((s) => ({ label: s, ...Object.fromEntries(sy.years.map((y) => [String(y), sy.cell(s, y).expenses])) }))}
                  series={sy.years.map((y) => ({ key: String(y), name: String(y), color: yearColor(sy.years, y, COLORS.yearsExp) }))}
                  onPick={(row, s) => { const y = Number(s.key); pick(`${row.label} ${y}`, sy.cell(row.label, y)); }}
                  barSize={16}
                />
              </ChartCard>

              <ChartCard
                title="Revenue, expenses and profit"
                legend={[{ name: 'Revenue', color: COLORS.revenue }, { name: 'Expenses', color: COLORS.expenses }, { name: 'Profit', color: COLORS.profit }]}
                columns={[{ key: 'label', label: 'Month' }, money('total', 'Revenue'), money('expenses', 'Expenses'), money('profit', 'Profit'), { key: 'margin', label: 'Margin', fmt: (v) => (v === null ? 'n/a' : `${v}%`), csv: (v) => (v === null ? '' : v) }]}
                rows={months.map((m) => ({ ...m, margin: m.total > 0 ? Math.round((m.profit / m.total) * 100) : null }))}
                csvName="revenue-expenses-profit"
                note="Profit margin is in the table view."
              >
                <BarsAndLine data={profitMonths} bars={[{ key: 'total', name: 'Revenue', color: COLORS.revenue }, { key: 'expenses', name: 'Expenses', color: COLORS.expenses }]} line={{ key: 'profit', name: 'Profit', color: COLORS.profit }} />
              </ChartCard>

            </div>
          </div>
          <DrillPanel drill={drill} onClose={() => setDrill(null)} mode="expenses" />
        </>
      )}
    </div>
  );
}
