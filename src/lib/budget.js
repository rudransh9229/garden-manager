import { parseISO } from './dates.js';

/** What was spent in one calendar month, per category: garden expenses by their own date, event costs by the event date. */
export function monthSpend(data, year, month) {
  const out = {};
  for (const o of data.overheadRows) if (o.year === year && o.month === month) out[o.category] = (out[o.category] || 0) + o.amount;
  for (const r of data.rows) {
    if (!r.counted || r.year !== year || r.month !== month) continue;
    for (const [cat, v] of Object.entries(r.byCat)) if (v) out[cat] = (out[cat] || 0) + v;
  }
  return out;
}

/** Each budgeted category for the month of `today`: [{ name, budget, spent, left, over, pct }], biggest overspend first. */
export function budgetStatus(settings, data, today) {
  const budgets = settings.budgets || {};
  const { y, m } = parseISO(today);
  const spend = monthSpend(data, y, m);
  return Object.entries(budgets)
    .filter(([, b]) => b > 0)
    .map(([name, budget]) => {
      const spent = spend[name] || 0;
      return { name, budget, spent, left: budget - spent, over: spent > budget, pct: Math.min(100, Math.round((spent / budget) * 100)) };
    })
    .sort((a, b) => (b.spent / b.budget) - (a.spent / a.budget));
}
