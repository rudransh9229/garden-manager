import { parseISO } from './dates.js';
import { LABOUR, expenseCategories } from './constants.js';

/**
 * Money rules (see CLAUDE.md):
 *  - Only Confirmed and Completed bookings count as revenue (their agreed total price).
 *  - Cancelled bookings never count their price or balance. Only the advance the owner KEPT
 *    counts, as "cancellation income", dated by the cancellation date.
 *  - Event expenses = typed expenses + labour worked out from attendance (wage x attendance).
 *  - Garden expenses are typed expenses with no booking (painting, repairs, yearly bills). They are not part of any
 *    one event; they reduce profit for the month, season and year they fall in.
 *  - Profit = revenue + cancellation income - event expenses - garden expenses.
 *  - An expense with paid === false is a bill still to pay: it counts as a cost now and is listed as owed.
 */
export const COUNTED = new Set(['Confirmed', 'Completed']);

const sum = (arr, f) => (arr || []).reduce((s, x) => s + f(x), 0);
function group(arr, key) {
  const m = new Map();
  for (const x of arr) {
    const k = x[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

export function seasonOf(settings, month) {
  const s = settings.seasons.find((x) => x.months.includes(month));
  return s ? s.name : 'Unassigned';
}

export function computeAll(state) {
  const { bookings, payments, expenses, cancellations, attendance, clients, staff, settings } = state;
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const pay = group(payments, 'bookingId');
  const exp = group(expenses, 'bookingId');
  const att = group(attendance, 'bookingId');
  const activeCancel = new Map();
  for (const c of cancellations) if (!c.restored) activeCancel.set(c.bookingId, c);

  const categories = [LABOUR, ...expenseCategories(settings)];
  for (const e of expenses) if (!categories.includes(e.category)) categories.push(e.category);

  const rows = bookings.map((b) => {
    const { y, m, d } = parseISO(b.date);
    const received = sum(pay.get(b.id), (p) => p.amount);
    const labour = sum(att.get(b.id), (a) => a.wageApplied || 0);
    const byCat = {};
    for (const cat of categories) byCat[cat] = 0;
    byCat[LABOUR] = labour;
    for (const e of exp.get(b.id) || []) byCat[e.category] = (byCat[e.category] || 0) + e.amount;
    const expensesTotal = Object.values(byCat).reduce((s, v) => s + v, 0);
    const counted = COUNTED.has(b.status);
    const revenue = counted ? b.total : 0;
    const pending = counted ? Math.max(0, b.total - received) : 0;
    const payState = !counted ? null : received <= 0 ? 'Unpaid' : pending > 0 ? 'Partial' : 'Paid';
    return {
      id: b.id,
      booking: b,
      client: clientById.get(b.clientId) || { name: 'Unknown client', phone: '' },
      eventType: b.eventType,
      year: y,
      month: m,
      day: d,
      season: seasonOf(settings, m),
      counted,
      received,
      revenue,
      collected: counted ? received : 0,
      pending,
      payState,
      labour,
      byCat,
      expenses: expensesTotal,
      profit: revenue - expensesTotal,
      cancellation: activeCancel.get(b.id) || null,
    };
  });
  const rowById = new Map(rows.map((r) => [r.id, r]));

  const cancelRows = [];
  for (const c of activeCancel.values()) {
    const r = rowById.get(c.bookingId);
    if (!r) continue;
    const { y, m } = parseISO(c.cancelledAt);
    cancelRows.push({
      bookingId: c.bookingId,
      date: c.cancelledAt,
      year: y,
      month: m,
      season: seasonOf(settings, m),
      amount: c.advanceKept,
      eventType: r.eventType,
      client: r.client,
      booking: r.booking,
    });
  }
  // Garden expenses: no booking attached (or the booking no longer exists).
  const overheadRows = [];
  for (const e of expenses) {
    if (e.bookingId) continue; // belongs to a booking (or to one that is gone): not a garden expense
    const { y, m } = parseISO(e.date);
    overheadRows.push({
      id: e.id, expense: e, date: e.date, year: y, month: m, season: seasonOf(settings, m),
      category: e.category, amount: e.amount, paid: e.paid !== false, vendor: e.vendor || '', mode: e.mode || '', note: e.note || '',
    });
  }
  return { rows, rowById, cancelRows, overheadRows, categories, clientById, staffById };
}

/** Totals over a list of event rows (+ optional cancellation rows and garden expenses). */
export function totals(rows, cancelRows = [], overheadRows = []) {
  const t = { revenue: 0, collected: 0, pending: 0, expenses: 0, eventExpenses: 0, overhead: 0, cancel: 0, events: 0 };
  for (const r of rows) {
    if (!r.counted) continue;
    t.revenue += r.revenue;
    t.collected += r.collected;
    t.pending += r.pending;
    t.expenses += r.expenses;
    t.eventExpenses += r.expenses;
    t.events += 1;
  }
  for (const c of cancelRows) t.cancel += c.amount;
  for (const o of overheadRows) { t.overhead += o.amount; t.expenses += o.amount; }
  t.total = t.revenue + t.cancel;
  t.profit = t.total - t.expenses;
  return t;
}
