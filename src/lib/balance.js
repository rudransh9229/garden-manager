import { LABOUR } from './constants.js';
import { isoFrom, parseISO } from './dates.js';
import { MONTHS } from './format.js';
import { makeXlsx } from './xlsx.js';

/**
 * The balance sheet is an income, expense and dues statement for one period (money rules in calc.js):
 *  - Income  = price of confirmed and completed events held in the period + advances kept from cancelled bookings.
 *  - Expenses = staff wages and costs typed on those events (by event date) + garden expenses (by their own date).
 *  - Still to collect = unpaid balance on those events. Bills still to pay = expenses marked "not paid yet" (dated today or earlier).
 *  - Profit = income - expenses. Cash view = what has actually been received minus what has actually been paid.
 * It is not an audited accounting balance sheet: there are no bank balances, assets or loans in the app.
 */

/** 'fy' = financial year April to March (India), 'cy' = calendar year, 'all' = everything. */
export function periodRange(kind, year) {
  if (kind === 'fy') return { from: isoFrom(year, 4, 1), to: isoFrom(year + 1, 3, 31), label: `FY ${year}-${String(year + 1).slice(2)}`, long: `1 Apr ${year} to 31 Mar ${year + 1}` };
  if (kind === 'cy') return { from: isoFrom(year, 1, 1), to: isoFrom(year, 12, 31), label: String(year), long: `1 Jan ${year} to 31 Dec ${year}` };
  return { from: '0000-01-01', to: '9999-12-31', label: 'All years', long: 'Every year in the app' };
}

/** Financial-year starts and calendar years that have any data, newest first. */
export function periodYears(data, today) {
  const dates = [today];
  for (const r of data.rows) dates.push(r.booking.date);
  for (const c of data.cancelRows) dates.push(c.date);
  for (const o of data.overheadRows) dates.push(o.date);
  const fy = new Set();
  const cy = new Set();
  for (const d of dates) {
    const { y, m } = parseISO(d);
    cy.add(y);
    fy.add(m >= 4 ? y : y - 1);
  }
  const desc = (a, b) => b - a;
  return { fy: [...fy].sort(desc), cy: [...cy].sort(desc) };
}

const within = (d, from, to) => d >= from && d <= to;
const sum = (list, f) => list.reduce((s, x) => s + f(x), 0);

export function buildStatement({ state, data, period, today }) {
  const { from, to } = period;
  const events = data.rows.filter((r) => r.counted && within(r.booking.date, from, to)).sort((a, b) => (a.booking.date < b.booking.date ? -1 : 1));
  const kept = data.cancelRows.filter((c) => within(c.date, from, to)).sort((a, b) => (a.date < b.date ? -1 : 1));
  const garden = data.overheadRows.filter((o) => within(o.date, from, to)).sort((a, b) => (a.date < b.date ? -1 : 1));
  const eventIds = new Set(events.map((r) => r.id));

  const income = { events: sum(events, (r) => r.revenue), kept: sum(kept, (c) => c.amount) };
  income.total = income.events + income.kept;

  const categories = data.categories;
  const catRows = categories.map((name) => {
    const event = sum(events, (r) => r.byCat[name] || 0);
    const gardenAmt = name === LABOUR ? 0 : sum(garden.filter((o) => o.category === name), (o) => o.amount);
    return { name, event, garden: gardenAmt, total: event + gardenAmt };
  }).filter((c) => c.total > 0);
  const expenses = { event: sum(events, (r) => r.expenses), garden: sum(garden, (o) => o.amount) };
  expenses.total = expenses.event + expenses.garden;

  const toCollect = sum(events, (r) => r.pending);
  const receivedFromClients = sum(events, (r) => r.collected) + income.kept;

  // Bills still to pay: marked "not paid yet" and dated today or earlier. Event costs belong to the period of their event.
  const unpaidEvent = state.expenses.filter((e) => e.bookingId && eventIds.has(e.bookingId) && e.paid === false && e.date <= today);
  const unpaidGarden = garden.filter((o) => !o.paid && o.date <= today);
  const bills = [
    ...unpaidGarden.map((o) => ({ date: o.date, category: o.category, vendor: o.vendor, note: o.note, forWhat: 'Garden', amount: o.amount })),
    ...unpaidEvent.map((e) => ({ date: e.date, category: e.category, vendor: e.vendor || '', note: e.note || '', forWhat: data.rowById.get(e.bookingId)?.client.name || 'Event', amount: e.amount })),
  ].sort((a, b) => (a.date < b.date ? -1 : 1));
  const toPay = sum(bills, (b) => b.amount);

  const profit = income.total - expenses.total;
  const paidOut = expenses.total - toPay;

  // Month by month
  const months = [];
  const all = [...events.map((r) => r.booking.date), ...kept.map((c) => c.date), ...garden.map((o) => o.date)].sort();
  const start = from > '1000' ? from : all[0];
  const end = to < '9000' ? to : all[all.length - 1];
  if (start && end) {
    let { y, m } = parseISO(start);
    const last = parseISO(end);
    while (y * 100 + m <= last.y * 100 + last.m) {
      const inM = (d) => { const p = parseISO(d); return p.y === y && p.m === m; };
      const inc = sum(events.filter((r) => inM(r.booking.date)), (r) => r.revenue) + sum(kept.filter((c) => inM(c.date)), (c) => c.amount);
      const evc = sum(events.filter((r) => inM(r.booking.date)), (r) => r.expenses);
      const gar = sum(garden.filter((o) => inM(o.date)), (o) => o.amount);
      months.push({ label: `${MONTHS[m - 1]} ${y}`, income: inc, eventCosts: evc, gardenCosts: gar });
      m === 12 ? (y++, (m = 1)) : m++;
    }
  }

  return {
    period, today, events, kept, garden, income, expenses, categories: catRows, toCollect, receivedFromClients, bills, toPay, profit, paidOut,
    cashNet: receivedFromClients - paidOut, months,
  };
}

const R = (paise) => Math.round(paise) / 100; // paise -> rupees

/** The Excel file: one workbook, several sheets, totals as live formulas. */
export async function statementWorkbook(st, gardenName) {
  const hdr = (labels, rightFrom = 99) => labels.map((l, i) => ({ v: l, s: i >= rightFrom ? 'headerR' : 'header' }));
  const sheets = [];

  // ---- Sheet 2: Monthly ----
  const monthly = [
    [{ v: 'Month by month', s: 'title' }],
    [{ v: `${st.period.label} · amounts in rupees`, s: 'note' }],
    [],
    hdr(['Month', 'Income', 'Event costs', 'Garden costs', 'Profit'], 1),
  ];
  const mFirst = monthly.length + 1;
  st.months.forEach((m, i) => {
    const r = mFirst + i;
    monthly.push([m.label, { v: R(m.income), s: 'money' }, { v: R(m.eventCosts), s: 'money' }, { v: R(m.gardenCosts), s: 'money' },
      { f: `B${r}-C${r}-D${r}`, v: R(m.income - m.eventCosts - m.gardenCosts), s: 'money' }]);
  });
  const mLast = monthly.length;
  const mTot = mLast + 1;
  const mSum = (col, key) => ({ f: st.months.length ? `SUM(${col}${mFirst}:${col}${mLast})` : '0', v: R(st.months.reduce((s, m) => s + m[key], 0)), s: 'moneyTotal' });
  monthly.push([{ v: 'Total', s: 'labelTotal' }, mSum('B', 'income'), mSum('C', 'eventCosts'), mSum('D', 'gardenCosts'),
    { f: `B${mTot}-C${mTot}-D${mTot}`, v: R(st.profit), s: 'moneyTotal' }]);

  // ---- Sheet 3: Events ----
  const ev = [
    [{ v: 'Events held', s: 'title' }],
    [{ v: 'Confirmed and completed events in the period. Staff wages come from attendance. "Received" is everything paid so far for the event.', s: 'note' }],
    [],
    hdr(['Date', 'Client', 'Type', 'Price', 'Received', 'Still to collect', 'Staff wages', 'Other event costs', 'Profit'], 3),
  ];
  const eFirst = ev.length + 1;
  st.events.forEach((r, i) => {
    const n = eFirst + i;
    const other = r.expenses - r.labour;
    ev.push([{ date: r.booking.date }, r.client.name, r.eventType, { v: R(r.revenue), s: 'money' }, { v: R(r.collected), s: 'money' }, { v: R(r.pending), s: 'money' },
      { v: R(r.labour), s: 'money' }, { v: R(other), s: 'money' }, { f: `D${n}-G${n}-H${n}`, v: R(r.revenue - r.expenses), s: 'money' }]);
  });
  const eLast = ev.length;
  const eTot = eLast + 1;
  const eSum = (col, v) => ({ f: st.events.length ? `SUM(${col}${eFirst}:${col}${eLast})` : '0', v: R(v), s: 'moneyTotal' });
  ev.push([{ v: 'Total', s: 'labelTotal' }, { v: '', s: 'labelTotal' }, { v: '', s: 'labelTotal' },
    eSum('D', st.income.events), eSum('E', st.events.reduce((s, r) => s + r.collected, 0)), eSum('F', st.toCollect),
    eSum('G', st.events.reduce((s, r) => s + r.labour, 0)), eSum('H', st.events.reduce((s, r) => s + r.expenses - r.labour, 0)),
    { f: `D${eTot}-G${eTot}-H${eTot}`, v: R(st.income.events - st.expenses.event), s: 'moneyTotal' }]);
  if (st.kept.length) {
    ev.push([]);
    ev.push([{ v: 'Advances kept from cancelled bookings', s: 'bold' }]);
    ev.push(hdr(['Cancelled on', 'Client', 'Booking type', 'Kept advance'], 3));
    const kFirst = ev.length + 1;
    for (const c of st.kept) ev.push([{ date: c.date }, c.client.name, c.eventType, { v: R(c.amount), s: 'money' }]);
    ev.push([{ v: 'Total', s: 'labelTotal' }, { v: '', s: 'labelTotal' }, { v: '', s: 'labelTotal' }, { f: `SUM(D${kFirst}:D${ev.length})`, v: R(st.income.kept), s: 'moneyTotal' }]);
  }

  // ---- Sheet 4: Garden expenses ----
  const ge = [
    [{ v: 'Garden expenses', s: 'title' }],
    [{ v: 'Costs not tied to one event: painting, repairs, bills and yearly costs.', s: 'note' }],
    [],
    hdr(['Date', 'Category', 'Paid to', 'Note', 'Payment mode', 'Status', 'Amount'], 6),
  ];
  const gFirst = ge.length + 1;
  for (const o of st.garden) ge.push([{ date: o.date }, o.category, o.vendor, o.note, o.mode, o.paid ? 'Paid' : 'Not paid yet', { v: R(o.amount), s: 'money' }]);
  const gLast = ge.length;
  ge.push([{ v: 'Total', s: 'labelTotal' }, ...Array(5).fill({ v: '', s: 'labelTotal' }), { f: st.garden.length ? `SUM(G${gFirst}:G${gLast})` : '0', v: R(st.expenses.garden), s: 'moneyTotal' }]);

  // ---- Sheet 5: Categories ----
  const cat = [
    [{ v: 'Expenses by category', s: 'title' }],
    [{ v: `${st.period.label} · event costs and garden costs together`, s: 'note' }],
    [],
    hdr(['Category', 'On events', 'Garden', 'Total', 'Share'], 1),
  ];
  const cFirst = cat.length + 1;
  const cLast = cFirst + st.categories.length - 1;
  const cTot = cLast + 1;
  st.categories.forEach((c, i) => {
    const n = cFirst + i;
    cat.push([c.name, { v: R(c.event), s: 'money' }, { v: R(c.garden), s: 'money' }, { f: `B${n}+C${n}`, v: R(c.total), s: 'money' },
      { f: `IF(D$${cTot}=0,0,D${n}/D$${cTot})`, v: st.expenses.total ? c.total / st.expenses.total : 0, s: 'pct' }]);
  });
  const cSum = (col, v) => ({ f: st.categories.length ? `SUM(${col}${cFirst}:${col}${cLast})` : '0', v: R(v), s: 'moneyTotal' });
  cat.push([{ v: 'Total', s: 'labelTotal' }, cSum('B', st.expenses.event), cSum('C', st.expenses.garden), cSum('D', st.expenses.total), { v: '', s: 'labelTotal' }]);

  // ---- Sheet 6: Dues ----
  const du = [
    [{ v: 'What is owed', s: 'title' }],
    [{ v: `As on ${st.today}`, s: 'note' }],
    [],
    [{ v: 'Still to collect from clients', s: 'bold' }],
    hdr(['Event date', 'Client', 'Price', 'Received', 'Still to collect'], 2),
  ];
  const dFirst = du.length + 1;
  const owing = st.events.filter((r) => r.pending > 0);
  for (const r of owing) du.push([{ date: r.booking.date }, r.client.name, { v: R(r.revenue), s: 'money' }, { v: R(r.collected), s: 'money' }, { v: R(r.pending), s: 'money' }]);
  du.push([{ v: 'Total', s: 'labelTotal' }, { v: '', s: 'labelTotal' }, { v: '', s: 'labelTotal' }, { v: '', s: 'labelTotal' }, { f: owing.length ? `SUM(E${dFirst}:E${du.length})` : '0', v: R(st.toCollect), s: 'moneyTotal' }]);
  const dCollectTot = du.length;
  du.push([]);
  du.push([{ v: 'Bills still to pay', s: 'bold' }]);
  du.push(hdr(['Date', 'Category', 'Paid to', 'For', 'Amount'], 4));
  const bFirst = du.length + 1;
  for (const b of st.bills) du.push([{ date: b.date }, b.category, b.vendor || b.note, b.forWhat, { v: R(b.amount), s: 'money' }]);
  du.push([{ v: 'Total', s: 'labelTotal' }, { v: '', s: 'labelTotal' }, { v: '', s: 'labelTotal' }, { v: '', s: 'labelTotal' }, { f: st.bills.length ? `SUM(E${bFirst}:E${du.length})` : '0', v: R(st.toPay), s: 'moneyTotal' }]);
  const dPayTot = du.length;

  // ---- Sheet 1: the statement itself (formulas point at the sheets above) ----
  const S = "'Events held'", C = "'By category'", D = "'What is owed'";
  const sum1 = [
    [{ v: `${gardenName || 'Garden'}: balance sheet`, s: 'title' }],
    [{ v: `${st.period.label} (${st.period.long})`, s: 'bold' }],
    [{ v: `Prepared on ${st.today}. Amounts in rupees. Figures are worked out from the records in the app.`, s: 'note' }],
    [],
    [{ v: 'INCOME', s: 'section' }, { v: '', s: 'section' }, { v: '', s: 'section' }],
  ];
  const row = (label, cell, note) => sum1.push([label, cell, note ? { v: note, s: 'note' } : null]);
  const at = () => sum1.length + 1; // the row number the next line will have
  const rIncomeEvents = at();
  row('Event income (price of events held)', { f: `${S}!D${eTot}`, v: R(st.income.events), s: 'money' }, 'Confirmed and completed events, by event date');
  const rKept = at();
  // the kept-advances total is the last row of the Events sheet when there are any
  row('Advances kept from cancelled bookings', { f: st.kept.length ? `${S}!D${ev.length}` : '0', v: R(st.income.kept), s: 'money' });
  const rIncomeTot = at();
  row({ v: 'Total income', s: 'labelTotal' }, { f: `B${rIncomeEvents}+B${rKept}`, v: R(st.income.total), s: 'moneyTotal' });
  sum1.push([]);
  sum1.push([{ v: 'EXPENSES', s: 'section' }, { v: '', s: 'section' }, { v: '', s: 'section' }]);
  const rExpFirst = at();
  st.categories.forEach((c, i) => row(c.name === LABOUR ? 'Staff wages (from attendance)' : c.name, { f: `${C}!D${cFirst + i}`, v: R(c.total), s: 'money' }));
  const rExpLast = at() - 1;
  const rExpTot = at();
  row({ v: 'Total expenses', s: 'labelTotal' }, { f: st.categories.length ? `SUM(B${rExpFirst}:B${rExpLast})` : '0', v: R(st.expenses.total), s: 'moneyTotal' });
  sum1.push([]);
  const rProfit = at();
  sum1.push([{ v: st.profit < 0 ? 'LOSS FOR THE PERIOD' : 'PROFIT FOR THE PERIOD', s: 'headlineLabel' }, { f: `B${rIncomeTot}-B${rExpTot}`, v: R(st.profit), s: 'headline' }, { v: 'Total income minus total expenses', s: 'note' }]);
  sum1.push([]);
  sum1.push([{ v: 'WHAT IS OWED', s: 'section' }, { v: '', s: 'section' }, { v: '', s: 'section' }]);
  const rCollect = at();
  row('Still to collect from clients', { f: `${D}!E${dCollectTot}`, v: R(st.toCollect), s: 'money' }, 'Balance due on events held in this period');
  const rPay = at();
  row('Bills still to pay', { f: `${D}!E${dPayTot}`, v: R(st.toPay), s: 'money' }, 'Expenses marked "not paid yet"');
  row({ v: 'Net amount owed to the garden', s: 'labelTotal' }, { f: `B${rCollect}-B${rPay}`, v: R(st.toCollect - st.toPay), s: 'moneyTotal' });
  sum1.push([]);
  sum1.push([{ v: 'CASH VIEW', s: 'section' }, { v: '', s: 'section' }, { v: '', s: 'section' }]);
  const rRecv = at();
  row('Received from clients', { v: R(st.receivedFromClients), s: 'money' }, 'Everything paid so far for these events, plus kept advances');
  const rPaid = at();
  row('Expenses actually paid', { f: `B${rExpTot}-B${rPay}`, v: R(st.paidOut), s: 'money' }, 'Total expenses minus bills still to pay');
  row({ v: 'Cash gained in the period', s: 'labelTotal' }, { f: `B${rRecv}-B${rPaid}`, v: R(st.cashNet), s: 'moneyTotal' });
  sum1.push([]);
  sum1.push([{ v: 'This is a management statement, not an audited accounting balance sheet: the app does not hold bank balances, assets or loans. Ask your accountant if you need a formal one.', s: 'note' }]);

  sheets.push(
    { name: 'Balance sheet', rows: sum1, cols: [42, 18, 58], landscape: false },
    { name: 'Month by month', rows: monthly, cols: [16, 16, 16, 16, 16], freezeRow: 4 },
    { name: 'Events held', rows: ev, cols: [14, 28, 14, 16, 16, 16, 16, 18, 16], freezeRow: 4 },
    { name: 'Garden expenses', rows: ge, cols: [14, 26, 24, 36, 16, 14, 16], freezeRow: 4 },
    { name: 'By category', rows: cat, cols: [28, 16, 16, 16, 10], freezeRow: 4 },
    { name: 'What is owed', rows: du, cols: [14, 26, 24, 26, 16] },
  );
  return makeXlsx(sheets, { title: `${gardenName || 'Garden'} balance sheet ${st.period.label}` });
}
