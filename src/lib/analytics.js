import { MONTHS } from './format.js';
import { CHART_CATEGORIES } from './constants.js';

/**
 * Filters shared by the Revenue Graphs and Expense Graphs pages:
 *   year ('all' or a number), season ('all' or a name), type ('all' or an event type),
 *   includeCancel (count kept advances from cancelled bookings).
 * A season is worked out from the date (see settings), never stored on the booking.
 */
export function applyFilters(all, f, { ignoreYear = false } = {}) {
  const okYear = (y) => ignoreYear || f.year === 'all' || y === f.year;
  const okSeason = (s) => f.season === 'all' || s === f.season;
  const okType = (t) => f.type === 'all' || t === f.type;
  const rows = all.rows.filter((r) => r.counted && okYear(r.year) && okSeason(r.season) && okType(r.eventType));
  const cancelRows = f.includeCancel
    ? all.cancelRows.filter((c) => okYear(c.year) && okSeason(c.season) && okType(c.eventType))
    : [];
  return { rows, cancelRows };
}

export function yearsIn(all) {
  const s = new Set();
  for (const r of all.rows) s.add(r.year);
  for (const c of all.cancelRows) s.add(c.year);
  return [...s].sort((a, b) => a - b);
}

const newBucket = (key, label) => ({
  key, label,
  revenue: 0, cancel: 0, total: 0, collected: 0, pending: 0, events: 0,
  expenses: 0, profit: 0,
  ...Object.fromEntries(CHART_CATEGORIES.map((c) => [c, 0])),
  _rows: [], _cancel: [],
});

/** Month-by-month buckets. One year selected -> Jan..Dec. All years -> the whole timeline. */
export function monthly({ rows, cancelRows }, year) {
  const buckets = new Map();
  const mk = (y, m) => {
    const key = year === 'all' ? y * 100 + m : m;
    if (!buckets.has(key)) {
      buckets.set(key, newBucket(key, year === 'all' ? `${MONTHS[m - 1]} '${String(y).slice(2)}` : MONTHS[m - 1]));
    }
    return buckets.get(key);
  };
  if (year !== 'all') for (let m = 1; m <= 12; m++) mk(year, m);
  for (const r of rows) {
    const b = mk(r.year, r.month);
    b.revenue += r.revenue; b.collected += r.collected; b.pending += r.pending;
    b.events += 1; b.expenses += r.expenses;
    for (const c of CHART_CATEGORIES) b[c] += r.byCat[c] || 0;
    b._rows.push(r);
  }
  for (const c of cancelRows) {
    const b = mk(c.year, c.month);
    b.cancel += c.amount;
    b._cancel.push(c);
  }
  const list = [...buckets.values()].sort((a, b) => a.key - b.key);
  if (year === 'all' && list.length) {
    // fill empty months inside the range so the timeline has no gaps
    const first = list[0].key, last = list[list.length - 1].key;
    const full = [];
    for (let y = Math.floor(first / 100), m = first % 100; y * 100 + m <= last; m === 12 ? (y++, (m = 1)) : m++) {
      full.push(buckets.get(y * 100 + m) || newBucket(y * 100 + m, `${MONTHS[m - 1]} '${String(y).slice(2)}`));
    }
    list.length = 0; list.push(...full);
  }
  for (const b of list) { b.total = b.revenue + b.cancel; b.profit = b.total - b.expenses; }
  return list;
}

/** season x year table. cell(season, year) -> {revenue, cancel, total, expenses, profit, events, _rows, _cancel} */
export function bySeasonYear({ rows, cancelRows }, settings) {
  const seasons = settings.seasons.map((s) => s.name);
  if (rows.some((r) => r.season === 'Unassigned') || cancelRows.some((c) => c.season === 'Unassigned')) seasons.push('Unassigned');
  const years = [...new Set([...rows.map((r) => r.year), ...cancelRows.map((c) => c.year)])].sort((a, b) => a - b);
  const cells = new Map();
  const cell = (s, y) => {
    const k = `${s}|${y}`;
    if (!cells.has(k)) cells.set(k, { revenue: 0, cancel: 0, total: 0, expenses: 0, profit: 0, events: 0, _rows: [], _cancel: [] });
    return cells.get(k);
  };
  for (const r of rows) {
    const c = cell(r.season, r.year);
    c.revenue += r.revenue; c.expenses += r.expenses; c.events += 1; c._rows.push(r);
  }
  for (const x of cancelRows) {
    const c = cell(x.season, x.year);
    c.cancel += x.amount; c._cancel.push(x);
  }
  for (const c of cells.values()) { c.total = c.revenue + c.cancel; c.profit = c.total - c.expenses; }
  const get = (s, y) => cells.get(`${s}|${y}`) || { revenue: 0, cancel: 0, total: 0, expenses: 0, profit: 0, events: 0, _rows: [], _cancel: [] };
  return { seasons, years, cell: get };
}

/** Same calendar month across years, for the year-over-year lines. */
export function yearOverYear({ rows, cancelRows }, metric) {
  const years = [...new Set([...rows.map((r) => r.year), ...cancelRows.map((c) => c.year)])].sort((a, b) => a - b);
  const data = MONTHS.map((label) => ({ label }));
  for (const y of years) for (const d of data) d[y] = 0;
  for (const r of rows) data[r.month - 1][r.year] += metric === 'expenses' ? r.expenses : r.revenue;
  if (metric !== 'expenses') for (const c of cancelRows) data[c.month - 1][c.year] += c.amount;
  return { years, data };
}

/** Booking types come from the data itself, so added, renamed and removed types always show correctly. */
export function byType({ rows, cancelRows }) {
  const m = new Map();
  const get = (t) => {
    if (!m.has(t)) m.set(t, { type: t, revenue: 0, cancel: 0, total: 0, events: 0, _rows: [], _cancel: [] });
    return m.get(t);
  };
  for (const r of rows) { const e = get(r.eventType); e.revenue += r.revenue; e.events += 1; e._rows.push(r); }
  for (const c of cancelRows) { const e = get(c.eventType); e.cancel += c.amount; e._cancel.push(c); }
  const list = [...m.values()];
  for (const e of list) e.total = e.revenue + e.cancel;
  return list.sort((a, b) => b.total - a.total);
}

export function byYear({ rows, cancelRows }) {
  const m = new Map();
  const get = (y) => { if (!m.has(y)) m.set(y, { year: y, revenue: 0, cancel: 0, total: 0, expenses: 0, events: 0, avgPrice: 0, avgExpense: 0 }); return m.get(y); };
  for (const r of rows) { const e = get(r.year); e.revenue += r.revenue; e.expenses += r.expenses; e.events += 1; }
  for (const c of cancelRows) get(c.year).cancel += c.amount;
  const list = [...m.values()].sort((a, b) => a.year - b.year);
  for (const e of list) {
    e.total = e.revenue + e.cancel;
    e.avgPrice = e.events ? Math.round(e.revenue / e.events) : 0;
    e.avgExpense = e.events ? Math.round(e.expenses / e.events) : 0;
  }
  return list;
}

/** Sum a measure by calendar month (1-12) over the filtered rows - used for "best month". */
export function byMonthOfYear({ rows, cancelRows }) {
  const out = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, label: MONTHS[i], revenue: 0, cancel: 0, total: 0, expenses: 0, events: 0 }));
  for (const r of rows) { const e = out[r.month - 1]; e.revenue += r.revenue; e.expenses += r.expenses; e.events += 1; }
  for (const c of cancelRows) out[c.month - 1].cancel += c.amount;
  for (const e of out) e.total = e.revenue + e.cancel;
  return out;
}

export const argmax = (list, f) => list.reduce((best, x) => (best === null || f(x) > f(best) ? x : best), null);

/** % change between this year and the previous one (same filters, year ignored). null when there is nothing to compare. */
export function growth(all, f, measure /* 'total' | 'expenses' */) {
  const filtered = applyFilters(all, f, { ignoreYear: true });
  const years = byYear(filtered);
  if (!years.length) return { pct: null, label: '' };
  const thisYear = f.year === 'all' ? years[years.length - 1].year : f.year;
  const cur = years.find((y) => y.year === thisYear);
  const prev = years.find((y) => y.year === thisYear - 1);
  if (!cur || !prev || !prev[measure]) return { pct: null, label: `${thisYear} vs ${thisYear - 1}` };
  return { pct: ((cur[measure] - prev[measure]) / prev[measure]) * 100, label: `${thisYear} vs ${thisYear - 1}` };
}
