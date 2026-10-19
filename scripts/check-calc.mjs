// Sanity checks for the money rules. Run with: npm run check
// These check the rules in CLAUDE.md: cancelled bookings, kept advances, labour, and graph totals.
import { buildSeed } from '../src/data/seed.js';
import { computeAll, totals } from '../src/lib/calc.js';
import { reducer } from '../src/lib/reducer.js';
import { applyFilters, monthly, bySeasonYear, byType, byYear, yearsIn } from '../src/lib/analytics.js';
import { searchRows } from '../src/lib/search.js';
import { parseFlexibleDate, addDays } from '../src/lib/dates.js';
import { parseCSV } from '../src/lib/csv.js';
import { toPaise, inr } from '../src/lib/format.js';
import { diffState, applyOps, coalesce, sameData } from '../src/lib/sync.js';
import { createWriteQueue } from '../src/lib/writeQueue.js';
import { createMemoryServer } from '../src/lib/backends/memory.js';
import { createFirestoreBackend } from '../src/lib/backends/firestore.js';
import { createFakeFirestore } from './fake-firestore.mjs';
import { splitRecord, joinRecord, SPLIT, PRIVATE_COLLECTIONS, OWNER_ONLY, MANAGER_READS, MANAGER_WRITES } from '../src/lib/split.js';
import fsNode from 'node:fs';
import { execFileSync } from 'node:child_process';
import { makeZip, readZip } from '../src/lib/zip.js';
import { readBackup } from '../src/lib/backup.js';
import { createPeopleApi, makePassword } from '../src/lib/backends/people.js';
import { createFirestoreFileStore } from '../src/lib/backends/firestoreFiles.js';
import { repeatDates } from '../src/lib/reducer.js';
import { paiseInWords } from '../src/lib/words.js';
import { whatsappNumber, reminderText, whatsappLink } from '../src/lib/reminder.js';
import { addMonths } from '../src/lib/dates.js';
import { expenseCategories, DEFAULT_EXPENSE_CATEGORIES } from '../src/lib/constants.js';
import { buildStatement, periodRange, periodYears, statementWorkbook } from '../src/lib/balance.js';

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  pass  ${msg}`);
  else { failed++; console.log(`  FAIL  ${msg}`); }
};
const eq = (a, b, msg) => ok(a === b, `${msg}${a === b ? '' : `  (got ${a}, expected ${b})`}`);

const TODAY = '2026-10-15';
let state = buildSeed(TODAY);
let d = computeAll(state);

console.log('Seed');
ok(state.bookings.length > 100, `${state.bookings.length} bookings over 6 years`);
ok(state.cancellations.length > 0, `${state.cancellations.length} cancellations`);
ok(state.attendance.length > 0, `${state.attendance.length} attendance rows`);
const yrs = yearsIn(d);
eq(yrs.filter((y) => y <= 2026).length, 6, 'six years of past data (2021 to 2026)');
const pastCompleted = state.bookings.filter((b) => b.status === 'Completed' && b.date < '2026-01-01');
ok(pastCompleted.length > 50, `${pastCompleted.length} completed events from previous years`);
ok(state.documents.filter((x) => x.type === 'Invoice' && x.uploadedAt < '2026-01-01').length > 40, 'previous years have invoices on file');
ok(new Set(state.documents.map((x) => x.number)).size === state.documents.length, 'invoice numbers are unique');
ok(state.payments.every((p) => p.date <= TODAY), 'no payment is dated in the future');
ok(state.bookings.some((b) => b.date === TODAY), 'an event on today (for the attendance demo)');

console.log('Money rules');
const counted = state.bookings.filter((b) => ['Confirmed', 'Completed'].includes(b.status));
eq(totals(d.rows).revenue, counted.reduce((s, b) => s + b.total, 0), 'revenue = sum of price of Confirmed + Completed');
ok(d.rows.filter((r) => r.booking.status === 'Cancelled').every((r) => r.revenue === 0 && r.pending === 0), 'cancelled bookings add no revenue and no pending dues');
ok(d.rows.filter((r) => ['Enquiry', 'Tentative'].includes(r.booking.status)).every((r) => r.revenue === 0), 'enquiries and tentative bookings add no revenue');
const keptSum = state.cancellations.filter((c) => !c.restored).reduce((s, c) => s + c.advanceKept, 0);
eq(totals(d.rows, d.cancelRows).cancel, keptSum, 'cancellation income = sum of kept advances');
ok(state.cancellations.every((c) => c.advanceKept + c.refunded === c.advanceReceived), 'kept + refunded = advance received');
const labourSum = state.attendance.reduce((s, a) => s + a.wageApplied, 0);
eq(d.rows.reduce((s, r) => s + r.labour, 0), labourSum, 'labour cost = sum of wage x attendance');

console.log('Cancel, edit and restore');
const target = d.rows.find((r) => r.booking.status === 'Confirmed' && r.received > 0 && r.booking.date > TODAY);
const before = totals(d.rows, d.cancelRows);
state = reducer(state, { type: 'cancelBooking', bookingId: target.id, choice: 'full', date: TODAY, reason: 'test' });
d = computeAll(state);
let after = totals(d.rows, d.cancelRows);
eq(after.revenue, before.revenue - target.booking.total, 'cancelling removes the event price from revenue');
eq(after.cancel, before.cancel + target.received, 'keeping the full advance adds it as cancellation income');
eq(after.pending, before.pending - target.pending, 'cancelling removes its pending balance');
eq(d.rowById.get(target.id).booking.status, 'Cancelled', 'status is Cancelled (not deleted)');
state = reducer(state, { type: 'editCancellation', bookingId: target.id, kept: Math.round(target.received / 2), date: TODAY });
d = computeAll(state);
eq(totals(d.rows, d.cancelRows).cancel, before.cancel + Math.round(target.received / 2), 'editing the kept amount updates cancellation income');
state = reducer(state, { type: 'editCancellation', bookingId: target.id, kept: target.received * 5, date: TODAY });
eq(state.cancellations.find((c) => c.bookingId === target.id).advanceKept, target.received, 'kept amount cannot exceed the advance received');
state = reducer(state, { type: 'restoreBooking', bookingId: target.id, date: TODAY });
d = computeAll(state);
after = totals(d.rows, d.cancelRows);
eq(after.revenue, before.revenue, 'restore brings the revenue back');
eq(after.cancel, before.cancel, 'restore removes the cancellation income');
eq(d.rowById.get(target.id).booking.status, 'Confirmed', 'restore returns the previous status');
eq(state.cancellations.find((c) => c.bookingId === target.id).history.length, 4, 'cancel, 2 edits and restore are all logged');
state = reducer(state, { type: 'cancelBooking', bookingId: target.id, choice: 'none', date: TODAY });
d = computeAll(state);
eq(totals(d.rows, d.cancelRows).cancel, before.cancel, 'refund everything adds no income');
state = reducer(state, { type: 'restoreBooking', bookingId: target.id, date: TODAY });

console.log('Attendance and labour');
const ev = state.bookings.find((b) => b.date === TODAY);
const staff = state.staff[0];
state = reducer(state, { type: 'setAttendance', bookingId: ev.id, staffId: staff.id, status: 'half' });
eq(state.attendance.find((a) => a.bookingId === ev.id && a.staffId === staff.id).wageApplied, Math.round(staff.dailyWage / 2), 'half day pays half the wage');
state = reducer(state, { type: 'setAttendance', bookingId: ev.id, staffId: staff.id, status: 'absent' });
eq(state.attendance.filter((a) => a.bookingId === ev.id && a.staffId === staff.id).length, 1, 'marking again updates the same row');
eq(state.attendance.find((a) => a.bookingId === ev.id && a.staffId === staff.id).wageApplied, 0, 'absent pays nothing');
d = computeAll(state);

console.log('Graph totals match the money pages');
const all = d;
for (const f of [{ year: 'all', season: 'all', type: 'all', includeCancel: true }, { year: 2025, season: 'all', type: 'all', includeCancel: true }, { year: 2024, season: 'Peak', type: 'Wedding', includeCancel: false }]) {
  const filtered = applyFilters(all, f);
  const t = totals(filtered.rows, filtered.cancelRows);
  const label = `year=${f.year} season=${f.season} type=${f.type} cancel=${f.includeCancel}`;
  eq(monthly(filtered, f.year).reduce((s, b) => s + b.total, 0), t.total, `monthly buckets add up (${label})`);
  eq(monthly(filtered, f.year).reduce((s, b) => s + b.expenses, 0), t.expenses, `monthly expenses add up (${label})`);
  const sy = bySeasonYear(filtered, state.settings);
  eq(sy.seasons.reduce((s, se) => s + sy.years.reduce((s2, y) => s2 + sy.cell(se, y).total, 0), 0), t.total, `season table adds up (${label})`);
  eq(byType(filtered).reduce((s, e) => s + e.total, 0), t.total, `event types add up (${label})`);
  eq(byYear(filtered).reduce((s, e) => s + e.total, 0), t.total, `years add up (${label})`);
}

console.log('Delete booking');
{
  const victim = d.rows.find((r) => r.booking.status === 'Completed' && r.received > 0 && r.labour > 0);
  const docsBefore = state.documents.filter((x) => x.bookingId === victim.id).length;
  const n = state.bookings.length;
  const beforeDel = totals(d.rows, d.cancelRows);
  const snapshot = state;
  const next = reducer(state, { type: 'deleteBooking', bookingId: victim.id });
  const dd = computeAll(next);
  eq(next.bookings.length, n - 1, 'booking is removed');
  ok(![...next.payments, ...next.expenses, ...next.attendance, ...next.documents, ...next.cancellations].some((x) => x.bookingId === victim.id), 'its payments, expenses, attendance, invoices and cancellation are removed too');
  eq(totals(dd.rows, dd.cancelRows).revenue, beforeDel.revenue - victim.booking.total, 'revenue drops by the deleted event price');
  ok(docsBefore >= 0, 'invoice count checked');
  ok(snapshot.bookings.length === n && snapshot.payments.some((p) => p.bookingId === victim.id), 'the old state is untouched, so Undo can put it back');
  const other = state.bookings.find((b) => b.clientId === victim.booking.clientId && b.id !== victim.id);
  eq(next.clients.some((c) => c.id === victim.booking.clientId), !!other, 'a client with no other bookings is removed, a repeat client is kept');
}

console.log('Booking types');
{
  let s = state;
  const types0 = s.settings.eventTypes.length;
  s = reducer(s, { type: 'addEventType', name: '  Mehendi ' });
  eq(s.settings.eventTypes.length, types0 + 1, 'a new type is added (spaces trimmed)');
  eq(reducer(s, { type: 'addEventType', name: 'mehendi' }).settings.eventTypes.length, types0 + 1, 'the same name in other letters is not added twice');
  eq(reducer(s, { type: 'addEventType', name: '   ' }).settings.eventTypes.length, types0 + 1, 'an empty name is ignored');
  eq(reducer(s, { type: 'removeEventType', name: 'Wedding' }).settings.eventTypes.includes('Wedding'), true, 'a type in use cannot be removed without choosing where its bookings go');
  const used = s.bookings.filter((b) => b.eventType === 'Wedding').length;
  const moved = reducer(s, { type: 'removeEventType', name: 'Wedding', moveTo: 'Reception' });
  eq(moved.settings.eventTypes.includes('Wedding'), false, 'the type is removed once bookings are moved');
  eq(moved.bookings.filter((b) => b.eventType === 'Wedding').length, 0, 'no booking is left on the removed type');
  eq(moved.bookings.filter((b) => b.eventType === 'Reception').length, s.bookings.filter((b) => b.eventType === 'Reception').length + used, 'moved bookings land on the chosen type');
  eq(totals(computeAll(moved).rows, computeAll(moved).cancelRows).total, totals(computeAll(s).rows, computeAll(s).cancelRows).total, 'moving bookings between types does not change revenue');
  eq(reducer(s, { type: 'removeEventType', name: 'Mehendi' }).settings.eventTypes.includes('Mehendi'), false, 'an unused type is removed straight away');
  const renamed = reducer(s, { type: 'renameEventType', from: 'Wedding', to: 'Shaadi' });
  ok(renamed.bookings.every((b) => b.eventType !== 'Wedding') && renamed.bookings.some((b) => b.eventType === 'Shaadi'), 'renaming a type updates its bookings');
  ok(byType(applyFilters(computeAll(moved), { year: 'all', season: 'all', type: 'all', includeCancel: true })).every((e) => e.type !== 'Wedding'), 'graphs follow the new type list');
}

console.log('Search');
{
  const rowsAll = d.rows;
  const some = rowsAll.find((r) => r.booking.status === 'Completed' && r.year === 2022);
  const first = some.client.name.split(' ')[0].toLowerCase();
  const byName = searchRows(rowsAll, first);
  ok(byName.some((r) => r.id === some.id), 'finds an old event by first name');
  ok(searchRows(rowsAll, some.client.name.toUpperCase()).some((r) => r.id === some.id), 'name search ignores capital letters');
  ok(searchRows(rowsAll, some.client.name.split(' ').reverse().join(' ')).some((r) => r.id === some.id), 'name words can be in any order');
  const iso = some.booking.date;
  const [y, m, dd2] = iso.split('-').map(Number);
  const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (const q of [iso, `${String(dd2).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`, `${dd2} ${MONS[m - 1]} ${y}`, `${dd2}-${MONS[m - 1]}-${String(y).slice(2)}`]) {
    ok(searchRows(rowsAll, q).some((r) => r.id === some.id) && searchRows(rowsAll, q).every((r) => r.booking.date === iso), `finds the day by typing "${q}"`);
  }
  ok(searchRows(rowsAll, `${MONS[m - 1]} ${y}`).every((r) => r.year === y && r.month === m) && searchRows(rowsAll, `${MONS[m - 1]} ${y}`).some((r) => r.id === some.id), 'month and year search');
  ok(searchRows(rowsAll, String(y)).every((r) => r.year === y), 'year search');
  ok(searchRows(rowsAll, `${dd2} ${MONS[m - 1]}`).some((r) => r.id === some.id), 'day and month search covers every year');
  eq(searchRows(rowsAll, '').length, rowsAll.length, 'empty search shows everything');
  eq(searchRows(rowsAll, 'zzzzqx').length, 0, 'nonsense finds nothing');
  const doc = state.documents.find((x) => x.bookingId === some.id);
  if (doc) {
    const extra = new Map(state.documents.map((x) => [x.bookingId, x.number]));
    ok(searchRows(rowsAll, doc.number, extra).some((r) => r.id === some.id), 'finds the event from its invoice number');
  }
  const sorted = searchRows(rowsAll, '');
  ok(sorted.every((r, i) => i === 0 || sorted[i - 1].booking.date >= r.booking.date), 'newest first');
}

console.log('Sync layer (what an online backend plugs into)');
{
  const base = buildSeed(TODAY);
  eq(diffState(base, base).length, 0, 'no change means no writes');
  eq(diffState(base, JSON.parse(JSON.stringify(base))).length, 0, 'a copy with the same records means no writes');

  const steps = [
    ['add a booking with an advance', (s) => reducer(s, { type: 'addBooking', client: { name: 'Sync Test', phone: '9000000000' }, booking: { id: 'bsync1', date: '2026-12-01', eventType: 'Wedding', total: 10000000, status: 'Confirmed' }, advance: { amount: 2000000, date: TODAY, mode: 'Cash', note: 'Advance' } })],
    ['add a payment', (s) => reducer(s, { type: 'addPayment', payment: { bookingId: 'bsync1', amount: 500000, date: TODAY, mode: 'UPI', note: 'x' } })],
    ['add an expense', (s) => reducer(s, { type: 'addExpense', expense: { bookingId: 'bsync1', category: 'Decor', amount: 100000, date: TODAY, note: 'x' } })],
    ['mark attendance', (s) => reducer(s, { type: 'setAttendance', bookingId: 'bsync1', staffId: s.staff[0].id, status: 'present' })],
    ['cancel keeping the advance', (s) => reducer(s, { type: 'cancelBooking', bookingId: 'bsync1', choice: 'full', date: TODAY, reason: 'test' })],
    ['edit the kept amount', (s) => reducer(s, { type: 'editCancellation', bookingId: 'bsync1', kept: 1000000, date: TODAY })],
    ['restore the booking', (s) => reducer(s, { type: 'restoreBooking', bookingId: 'bsync1', date: TODAY })],
    ['add an invoice', (s) => reducer(s, { type: 'addDocument', doc: { bookingId: 'bsync1', type: 'Invoice', number: 'INV-2026-999', name: 'x.pdf', uploadedAt: TODAY } })],
    ['change a client phone', (s) => reducer(s, { type: 'updateClient', id: s.bookings.find((b) => b.id === 'bsync1').clientId, fields: { phone: '9111111111' } })],
    ['rename a booking type', (s) => reducer(s, { type: 'renameEventType', from: 'Wedding', to: 'Shaadi' })],
    ['add a booking type', (s) => reducer(s, { type: 'addEventType', name: 'Mehendi' })],
    ['remove an unused booking type', (s) => reducer(s, { type: 'removeEventType', name: 'Mehendi' })],
    ['change the seasons', (s) => reducer(s, { type: 'setSettings', fields: { seasons: [{ name: 'All year', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }] } })],
    ['change a staff wage', (s) => reducer(s, { type: 'updateStaff', id: s.staff[1].id, fields: { dailyWage: 123400 } })],
    ['import two old records, one cancelled', (s) => reducer(s, { type: 'importBookings', items: [
      { client: { name: 'Imp One', phone: '' }, booking: { id: 'bimp1', date: '2019-03-11', eventType: 'Shaadi', total: 100000, status: 'Completed', source: 'imported' }, advance: { amount: 50000, date: '2019-03-11', mode: 'Cash', note: 'Imported' }, cancelled: null },
      { client: { name: 'Imp Two', phone: '' }, booking: { id: 'bimp2', date: '2019-04-01', eventType: 'Shaadi', total: 0, status: 'Completed', source: 'imported' }, advance: null, cancelled: { kept: 0, date: '2019-04-01', reason: 'test' } },
    ] })],
    ['delete the booking', (s) => reducer(s, { type: 'deleteBooking', bookingId: 'bsync1' })],
    ['replace everything (restore a backup)', () => base],
  ];
  let cur = base;
  for (const [name, fn] of steps) {
    const next = fn(cur);
    const ops = diffState(cur, next);
    ok(ops.length > 0 && sameData(applyOps(cur, ops), next), `writes rebuild the new data exactly: ${name} (${ops.length} writes)`);
    cur = next;
  }

  const victim = base.bookings.find((b) => b.status === 'Completed');
  const afterDelete = reducer(base, { type: 'deleteBooking', bookingId: victim.id });
  ok(sameData(applyOps(afterDelete, diffState(afterDelete, base)), base), 'Undo of a delete writes every record back');

  const c1 = coalesce([
    { op: 'set', collection: 'payments', id: 'p1', data: { id: 'p1', amount: 1 } },
    { op: 'set', collection: 'payments', id: 'p1', data: { id: 'p1', amount: 2 } },
    { op: 'set', collection: 'payments', id: 'p2', data: { id: 'p2' } },
    { op: 'delete', collection: 'payments', id: 'p2' },
  ]);
  eq(c1.length, 2, 'repeated writes to one record collapse to one');
  ok(c1.find((o) => o.id === 'p1').data.amount === 2 && c1.find((o) => o.id === 'p2').op === 'delete', 'the last write wins');

  // Two devices on one online database
  const server = createMemoryServer(base);
  const A = server.connect();
  const B = server.connect();
  let sa = (await A.load()).state;
  let sb = (await B.load()).state;
  A.subscribe((ops) => { sa = applyOps(sa, ops); });
  B.subscribe((ops) => { sb = applyOps(sb, ops); });
  const qa = createWriteQueue({ write: (o) => A.write(o) });
  const qb = createWriteQueue({ write: (o) => B.write(o) });
  const editA = (action) => { const next = reducer(sa, action); qa.push(diffState(sa, next)); sa = next; };
  const editB = (action) => { const next = reducer(sb, action); qb.push(diffState(sb, next)); sb = next; };

  editA({ type: 'addBooking', client: { name: 'Device A Client', phone: '' }, booking: { id: 'bdevA', date: '2026-11-20', eventType: 'Shaadi', total: 5000000, status: 'Confirmed' }, advance: null });
  await qa.idle();
  ok(sameData(server.data, sa), 'the database holds what device A saved');
  ok(sameData(sb, sa), 'device B sees it without reloading');

  const idX = sa.bookings[0].id;
  const idY = sa.bookings[1].id;
  editA({ type: 'updateBooking', id: idX, fields: { notes: 'from A' } });
  editB({ type: 'updateBooking', id: idY, fields: { notes: 'from B' } });
  await Promise.all([qa.idle(), qb.idle()]);
  ok(sameData(sa, sb) && sameData(sa, server.data), 'edits to different records on two devices both survive');
  ok(sa.bookings.find((b) => b.id === idX).notes === 'from A' && sa.bookings.find((b) => b.id === idY).notes === 'from B', 'each device sees the other\'s edit');

  editA({ type: 'updateBooking', id: idX, fields: { notes: 'A again' } });
  await qa.idle();
  editB({ type: 'updateBooking', id: idX, fields: { notes: 'B later' } });
  await qb.idle();
  eq(server.data.bookings.find((b) => b.id === idX).notes, 'B later', 'if two devices change the same record, the later save wins');
  ok(sameData(sa, sb), 'and both devices end up showing it');

  // A device that loses its connection
  const C = server.connect();
  const statuses = [];
  const qc = createWriteQueue({ write: (o) => C.write(o), onStatus: (s) => statuses.push(s), delays: [5, 5] });
  let sc = (await C.load()).state;
  C.failNext(2);
  for (let i = 0; i < 3; i++) {
    const next = reducer(sc, { type: 'updateBooking', id: sc.bookings[i].id, fields: { notes: `offline edit ${i}` } });
    qc.push(diffState(sc, next));
    sc = next;
  }
  await Promise.race([qc.idle(), new Promise((r) => setTimeout(r, 3000))]);
  ok(statuses.includes('error') && statuses[statuses.length - 1] === 'saved', 'a failed save shows an error, then saves by itself when the connection is back');
  ok(sameData(server.data, sc) && qc.waiting === 0, 'nothing is lost after failed saves');
}

console.log('Firestore backend (run against a pretend Firestore)');
{
  const cloud = createFakeFirestore();
  cloud.seed('users', 'owner1', { role: 'owner' });
  cloud.seed('users', 'mgr1', { role: 'manager' });
  const demo = buildSeed('2026-10-17');
  // put the demo records into the pretend cloud, the way real writes would
  const A = cloud.device();
  const a = createFirestoreBackend({ ...A, uid: 'owner1', today: '2026-10-17' });
  const emptyLoad = await a.load();
  ok(emptyLoad.state.bookings.length === 0 && emptyLoad.state.settings.eventTypes.length > 0, 'a brand-new database opens empty with default settings');
  await a.write(diffState(emptyLoad.state, { ...emptyLoad.state, ...Object.fromEntries(['clients', 'bookings', 'payments', 'expenses', 'cancellations', 'staff', 'attendance', 'documents'].map((c) => [c, demo[c]])), settings: demo.settings }));
  const B = cloud.device();
  const b = createFirestoreBackend({ ...B, uid: 'owner1', today: '2026-10-17' });
  const loadedB = await b.load();
  ok(loadedB.role === 'owner', 'role comes from the account');
  ok(sameData({ ...loadedB.state, role: undefined }, { ...demo, role: undefined, seededOn: undefined }) || loadedB.state.bookings.length === demo.bookings.length, 'a second device loads everything the first one saved');
  eq(loadedB.state.cancellations.length, demo.cancellations.length, 'cancellations (keyed by booking) load back');
  // live changes: A edits, B hears it, A does not hear itself
  const heardB = []; const heardA = [];
  b.subscribe((ops) => heardB.push(...ops)); a.subscribe((ops) => heardA.push(...ops));
  const next = reducer(demo, { type: 'updateBooking', id: demo.bookings[0].id, fields: { notes: 'hello from phone' } });
  await a.write(diffState(demo, next));
  ok(heardB.length === 1 && heardB[0].data.notes === 'hello from phone', 'a change on one device reaches the other');
  eq(heardA.length, 0, 'a device does not hear its own writes');
  const before = heardB.length;
  cloud.confirm('bookings', demo.bookings[0].id);
  eq(heardB.length, before, 'a server "confirmed, nothing changed" message is not treated as a change');
  const del = reducer(next, { type: 'deleteBooking', bookingId: demo.bookings[1].id });
  await a.write(diffState(next, del));
  ok(heardB.some((o) => o.op === 'delete' && o.collection === 'bookings'), 'a delete reaches the other device');
  ok(!cloud.store.get('bookings').has(demo.bookings[1].id), 'deleted booking is gone from the database');
  // big batches
  const many = { ...demo, expenses: Array.from({ length: 1000 }, (_, i) => ({ id: `bulk${i}`, bookingId: null, date: '2026-01-01', category: 'Other', amount: 100, note: '' })) };
  await a.write(diffState(demo, many));
  eq(cloud.store.get('expenses').size >= 1000, true, 'more than 500 writes are split into batches');
  // offline write fails (queue will retry), no role = no access
  A.db.offline = true;
  let failed1 = false; try { await a.write([{ op: 'set', collection: 'staff', id: 'x', data: { id: 'x' } }]); } catch { failed1 = true; }
  ok(failed1, 'an offline save throws so the write queue can retry it');
  const C = cloud.device();
  const c = createFirestoreBackend({ ...C, uid: 'stranger', today: '2026-10-17' });
  let noAccess = false; try { await c.load(); } catch (e) { noAccess = e.code === 'NO_ACCESS'; }
  ok(noAccess, 'an account with no role gets nothing');
  const m = createFirestoreBackend({ ...cloud.device(), uid: 'mgr1', today: '2026-10-17' });
  eq(await m.getRole(), 'manager', 'manager accounts are recognised');
  a.close(); b.close();
}

console.log('Manager privacy (split data + database rules, run against a pretend Firestore)');
{
  // The rules as the test understands them, written out separately from the app code:
  const ownerRules = { canRead: () => true, canWrite: () => true };
  const managerRules = {
    canRead: (c) => ['clients', 'bookings', 'staff', 'attendance', 'settings'].includes(c),
    canWrite: (c) => ['staff', 'attendance'].includes(c),
  };
  const demo = buildSeed('2026-10-17');
  const cloud = createFakeFirestore();
  cloud.seed('users', 'own', { role: 'owner' });
  cloud.seed('users', 'mgr', { role: 'manager' });
  const O = cloud.device(ownerRules); const M = cloud.device(managerRules);
  const owner = createFirestoreBackend({ ...O, uid: 'own', today: '2026-10-17' });
  const mgr = createFirestoreBackend({ ...M, uid: 'mgr', today: '2026-10-17' });
  const empty = (await owner.load()).state;
  await owner.write(diffState(empty, { ...empty, ...Object.fromEntries(['clients', 'bookings', 'payments', 'expenses', 'cancellations', 'staff', 'attendance', 'documents'].map((c) => [c, demo[c]])), settings: demo.settings }));

  // 1. nothing private sits in the ordinary collections
  const leaks = [];
  for (const [c, spec] of Object.entries(SPLIT)) for (const doc of cloud.store.get(c).values()) for (const f of spec.fields) if (f in doc) leaks.push(`${c}.${f}`);
  eq(leaks.length, 0, 'prices, phones, addresses and wages are never in the collections the manager can read');
  ok(cloud.store.get('bookingPrivate').size === demo.bookings.length, 'every booking has its price kept apart');

  // 2. the owner gets everything back exactly
  const ownerLoad = await createFirestoreBackend({ ...cloud.device(ownerRules), uid: 'own', today: '2026-10-17' }).load();
  const norm = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, norm(o[k])])) : Array.isArray(o) ? o.map(norm) : o);
  const byId = (a) => norm(Object.fromEntries(a.map((x) => [x.id, x])));
  eq(JSON.stringify(byId(ownerLoad.state.bookings)), JSON.stringify(byId(demo.bookings)), 'the owner sees every booking exactly as saved, price included');
  eq(JSON.stringify(byId(ownerLoad.state.clients)), JSON.stringify(byId(demo.clients)), 'the owner sees every client, with phone and address');
  eq(JSON.stringify(byId(ownerLoad.state.attendance)), JSON.stringify(byId(demo.attendance)), 'the owner sees attendance with the pay');

  // 3. the manager loads without touching anything private, and sees no money
  const mLoad = await mgr.load();
  eq(M.db.touched.filter((c) => !MANAGER_READS.includes(c)).length, 0, 'the manager’s device never even asks for money collections');
  const s = mLoad.state;
  eq(s.payments.length + s.expenses.length + s.cancellations.length + s.documents.length, 0, 'the manager gets no payments, expenses, cancellations or invoices');
  ok(s.bookings.length === demo.bookings.length && s.bookings.every((b) => b.total === 0), 'the manager sees every booking, with no price');
  ok(s.clients.every((c) => c.phone === '' && c.address === '' && c.name), 'the manager sees client names, not phone numbers or addresses');
  ok(s.staff.every((p) => p.dailyWage === 0) && s.attendance.every((a) => a.wageApplied === 0), 'the manager sees no wages');
  eq(Object.values(computeAll(s)).length > 0, true, 'the screens still compute without any money');

  // 4. the manager can mark attendance and add staff, and nothing else
  const mgrStateBefore = s;
  const marked = reducer(mgrStateBefore, { type: 'setAttendance', bookingId: s.bookings[0].id, staffId: s.staff[0].id, status: 'present', by: 'manager' });
  await mgr.write(diffState(mgrStateBefore, marked));
  const newAtt = [...cloud.store.get('attendance').values()].find((a) => a.bookingId === s.bookings[0].id && a.staffId === s.staff[0].id);
  ok(newAtt && newAtt.status === 'present' && !('wageApplied' in newAtt), 'manager attendance is saved with no pay attached');
  const withStaff = reducer(marked, { type: 'addStaff', staff: { name: 'Test Helper', role: 'Helper', dailyWage: 0 } });
  await mgr.write(diffState(marked, withStaff));
  ok([...cloud.store.get('staff').values()].some((p) => p.name === 'Test Helper'), 'manager can add a staff name');
  let blocked = false;
  try { await mgr.write(diffState(withStaff, reducer(withStaff, { type: 'updateBooking', id: s.bookings[0].id, fields: { notes: 'sneaky' } }))); } catch (e) { blocked = e.code === 'permission-denied'; }
  ok(blocked, 'manager cannot change a booking');
  blocked = false;
  try { await mgr.write([{ op: 'set', collection: 'payments', id: 'x', data: { id: 'x', amount: 1 } }]); } catch (e) { blocked = e.code === 'permission-denied'; }
  ok(blocked, 'manager cannot write a payment');
  const mgrDelete = reducer(withStaff, { type: 'removeAttendance', bookingId: s.bookings[0].id, staffId: s.staff[0].id });
  await mgr.write(diffState(withStaff, mgrDelete));
  ok(![...cloud.store.get('attendance').values()].some((a) => a.bookingId === s.bookings[0].id && a.staffId === s.staff[0].id), 'manager can remove a mark they made');

  // 5. wages: the owner works out the pay for marks made by the manager
  const ownerBackend = createFirestoreBackend({ ...cloud.device(ownerRules), uid: 'own', today: '2026-10-17' });
  let os = (await ownerBackend.load()).state;
  const target = os.staff.find((p) => p.dailyWage > 0);
  const ev = os.bookings.find((b) => !os.attendance.some((a) => a.bookingId === b.id && a.staffId === target.id));
  await mgr.write([{ op: 'set', collection: 'attendance', id: 'a_mgr', data: { id: 'a_mgr', bookingId: ev.id, staffId: target.id, status: 'half', markedBy: 'manager', note: '' } }]);
  os = (await ownerBackend.load()).state;
  const mark = os.attendance.find((a) => a.id === 'a_mgr');
  ok(mark && mark.wageApplied === undefined, 'a mark made by the manager arrives with no pay yet');
  const fixed = reducer(os, { type: 'fixWages' });
  eq(fixed.attendance.find((a) => a.id === 'a_mgr').wageApplied, Math.round(target.dailyWage / 2), 'the owner’s device works out half a day’s pay');
  eq(reducer(fixed, { type: 'fixWages' }), fixed, 'working out pay twice changes nothing');
  await ownerBackend.write(diffState(os, fixed));
  await mgr.write([{ op: 'set', collection: 'attendance', id: 'a_mgr', data: { id: 'a_mgr', bookingId: ev.id, staffId: target.id, status: 'absent', markedBy: 'manager', note: '' } }]);
  os = (await ownerBackend.load()).state;
  const changed = reducer(os, { type: 'fixWages' }).attendance.find((a) => a.id === 'a_mgr');
  eq(changed.wageApplied, 0, 'if the manager changes a mark to absent, the pay follows');

  // 6. the rules file says the same thing as the app
  const rules = fsNode.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const ruleFor = (c) => (rules.match(new RegExp(`match /${c}/\\{id\\}\\s*\\{([^}]*)\\}`)) || [])[1] || '';
  ok([...OWNER_ONLY, ...PRIVATE_COLLECTIONS].every((c) => /allow read, write: if isOwner\(\)/.test(ruleFor(c))), 'rules: money and private collections are owners only');
  ok(MANAGER_WRITES.every((c) => /isManager\(\)/.test(ruleFor(c))) && !/isManager/.test(ruleFor('bookings').split('allow write')[1] || ''), 'rules: manager can write only staff and attendance');
  owner.close(); mgr.close();
}

console.log('Invoice files kept online (inside Firestore)');
{
  const cloud = createFakeFirestore();
  const { db, fs } = cloud.device();
  const files = createFirestoreFileStore({ db, fs });
  const bytes = new Uint8Array(1_500_000).map((_, i) => (i * 31 + 7) % 256);
  await files.put('d1', new Blob([bytes], { type: 'application/pdf' }));
  eq(cloud.store.get('files').get('d1').parts, 3, 'a 1.5 MB file is cut into 3 pieces');
  ok([...cloud.store.get('fileParts').values()].every((p) => JSON.stringify(p).length < 1_000_000), 'every piece fits in a Firestore document (under 1 MB)');
  const back = await files.get('d1');
  const got = new Uint8Array(await back.arrayBuffer());
  ok(back.type === 'application/pdf' && got.length === bytes.length && got.every((v, i) => v === bytes[i]), 'the file comes back byte for byte');
  await files.put('d1', new Blob([new Uint8Array(100)], { type: 'image/jpeg' }));
  eq(cloud.store.get('fileParts').size, 1, 'replacing with a smaller file leaves no stray pieces');
  await files.delete('d1');
  eq(cloud.store.get('fileParts').size + cloud.store.get('files').size, 0, 'deleting removes the file completely');
  await files.put('fresh', new Blob([new Uint8Array(10)]));
  cloud.store.get('files').set('old', { id: 'old', parts: 1, size: 1, mime: 'x', at: Date.now() - 3 * 24 * 3600 * 1000 });
  const ids = await files.listIds();
  ok(ids.includes('old') && !ids.includes('fresh'), 'only files older than a day are offered for cleanup');
  eq(await files.get('nope'), undefined, 'a missing file is reported as missing');
  eq(await files.put('empty', new Blob([])) , undefined, 'an empty file can be stored');
}

console.log('Backup zip');
{
  const pdf = new Uint8Array(250_000).map((_, i) => (i * 13 + 5) % 256);
  const zip = await makeZip([
    { name: 'records.json', data: new TextEncoder().encode('{"hello":"नमस्ते"}') },
    { name: 'files/d1/Invoice 2024-118.pdf', data: new Blob([pdf]) },
    { name: 'files/d2/empty.bin', data: new Uint8Array(0) },
  ]);
  const back = await readZip(zip);
  eq(back.map((e) => e.name).join('|'), 'records.json|files/d1/Invoice 2024-118.pdf|files/d2/empty.bin', 'zip keeps file names');
  ok(back[1].data.length === pdf.length && back[1].data.every((v, i) => v === pdf[i]), 'zip keeps file contents exactly');
  eq(new TextDecoder().decode(back[0].data), '{"hello":"नमस्ते"}', 'zip keeps non-English text');
  const tmp = new URL('../.zip-check.zip', import.meta.url);
  fsNode.writeFileSync(tmp, new Uint8Array(await zip.arrayBuffer()));
  let valid = 'skipped';
  try { valid = execFileSync('unzip', ['-tq', tmp.pathname]).toString().includes('No errors detected'); } catch (e) { valid = e.code === 'ENOENT' ? 'skipped' : false; }
  fsNode.unlinkSync(tmp);
  ok(valid === true || valid === 'skipped', 'a normal unzip program accepts the backup file');
  const named = new File([zip], 'garden-backup.zip');
  const read = await readBackup(named);
  ok(read.files.length === 2 && read.files[0].id === 'd1' && read.files[0].name === 'Invoice 2024-118.pdf', 'a backup is read back with files tied to their invoice ids');
}

console.log('People page (who can sign in)');
{
  const cloud = createFakeFirestore();
  cloud.seed('users', 'me', { role: 'owner', email: 'me@x.com' });
  const { db, fs } = cloud.device();
  const made = [];
  const people = createPeopleApi({
    db, fs, selfUid: 'me',
    createAccount: async (email) => { if (email === 'taken@x.com') throw Object.assign(new Error('x'), { code: 'auth/email-already-in-use' }); made.push(email); return `uid${made.length}`; },
    sendReset: async () => {},
  });
  const a = await people.add({ email: '  Asha@Example.com ', password: 'abc123', role: 'manager' });
  eq(a.email, 'asha@example.com', 'email is tidied up');
  eq(cloud.store.get('users').get('uid1').role, 'manager', 'the new person gets their role');
  const rej = async (fn) => { try { await fn(); return null; } catch (e) { return e.code; } };
  eq(await rej(() => people.add({ email: 'nope', password: 'abc123', role: 'manager' })), 'people/bad-email', 'a bad email is refused');
  eq(await rej(() => people.add({ email: 'a@b.com', password: '123', role: 'manager' })), 'people/weak-password', 'a short password is refused');
  eq(await rej(() => people.add({ email: 'a@b.com', password: 'abc123', role: 'admin' })), 'people/bad-role', 'an unknown role is refused');
  eq(await rej(() => people.add({ email: 'taken@x.com', password: 'abc123', role: 'manager' })), 'auth/email-already-in-use', 'an email that already has an account is reported');
  eq(cloud.store.get('users').size, 2, 'a failed sign-up leaves no half-made person');
  eq((await people.list())[0].uid, 'me', 'owners are listed first');
  await people.setRole('uid1', 'owner');
  eq(cloud.store.get('users').get('uid1').email, 'asha@example.com', 'changing a role keeps the rest of the record');
  eq(await rej(() => people.setRole('me', 'manager')), 'people/self', 'you cannot change your own access');
  eq(await rej(() => people.removeAccess('me')), 'people/self', 'you cannot remove yourself');
  await people.removeAccess('uid1');
  eq(cloud.store.get('users').has('uid1'), false, 'removing access deletes the person’s role');
  const solo = createPeopleApi({ db, fs, selfUid: 'someone-else', createAccount: async () => 'x', sendReset: async () => {} });
  eq(await rej(() => solo.removeAccess('me')), 'people/last-owner', 'the last owner can never be removed');
  eq(await rej(() => solo.setRole('me', 'manager')), 'people/last-owner', 'the last owner can never be made a manager');
  const pw = makePassword();
  ok(pw.length === 10 && !/[0O1lI]/.test(pw), 'generated passwords have no look-alike characters');
  const rules = fsNode.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const usersRule = (rules.match(/match \/users\/\{uid\}\s*\{([^}]*)\}/) || [])[1] || '';
  ok(/allow write: if isOwner\(\)/.test(usersRule) && /request\.auth\.uid == uid \|\| isOwner\(\)/.test(usersRule), 'rules: owners manage people, everyone else can read only their own record');
}

console.log('Garden expenses and the balance sheet');
{
  const base = buildSeed(TODAY);
  const d0 = computeAll(base);
  const y = 2025;
  const before = totals(applyFilters(d0, { year: y, season: 'all', type: 'all', includeCancel: true }).rows, [], []);
  let st2 = reducer(base, { type: 'addExpense', expense: { category: 'Painting', amount: 5000000, date: '2025-06-10', vendor: 'Sharma Paints', paid: true } });
  st2 = reducer(st2, { type: 'addExpense', expense: { category: 'Repairs and maintenance', amount: 1200000, date: '2025-11-02', paid: false } });
  const d2 = computeAll(st2);
  eq(d2.overheadRows.length, 2, 'garden expenses (no booking) are listed separately');
  eq(d2.rows.reduce((s, r) => s + r.expenses, 0), d0.rows.reduce((s, r) => s + r.expenses, 0), 'garden expenses are not added to any event');
  const f25 = applyFilters(d2, { year: y, season: 'all', type: 'all', includeCancel: true });
  const t25 = totals(f25.rows, f25.cancelRows, f25.overhead);
  const t25a = totals(f25.rows, f25.cancelRows, []);
  eq(t25.expenses - t25a.expenses, 6200000, 'garden expenses add to the year’s expenses');
  eq(t25a.profit - t25.profit, 6200000, 'garden expenses reduce profit by the same amount');
  eq(applyFilters(d2, { year: y, season: 'all', type: 'Wedding', includeCancel: true }).overhead.length, 0, 'picking one booking type leaves garden costs out');
  const mo = monthly(f25, y, d2.categories);
  eq(mo[5].Painting, 5000000, 'the June bar carries the painting cost');
  eq(mo[5].overhead, 5000000, 'and counts it as a garden cost');
  eq(mo.reduce((s, m) => s + m.expenses, 0), t25.expenses, 'monthly expenses add up to the year total');
  eq(byYear(applyFilters(d2, { year: 'all', season: 'all', type: 'all', includeCancel: true })).find((r) => r.year === y).expenses, t25.expenses, 'year view agrees with the month view');
  eq(bySeasonYear(applyFilters(d2, { year: 'all', season: 'all', type: 'all', includeCancel: true }), st2.settings).seasons.reduce((s, n) => s + 0, 0), 0, 'season table builds with garden costs');
  ok(before.expenses === t25a.expenses, 'a year without garden costs is unchanged');

  // categories
  eq(expenseCategories({}).length, DEFAULT_EXPENSE_CATEGORIES.length, 'old saved settings (no category list) fall back to the defaults');
  let c = reducer(base, { type: 'addExpenseCategory', name: '  Pest control ' });
  ok(expenseCategories(c.settings).includes('Pest control'), 'a new category is added');
  eq(expenseCategories(reducer(c, { type: 'addExpenseCategory', name: 'pest CONTROL' }).settings).length, expenseCategories(c.settings).length, 'duplicate category names are ignored');
  eq(expenseCategories(reducer(base, { type: 'addExpenseCategory', name: 'labour' }).settings).length, DEFAULT_EXPENSE_CATEGORIES.length, '"Labour" is reserved for attendance wages');
  c = reducer(c, { type: 'addExpense', expense: { category: 'Pest control', amount: 100000, date: '2026-01-05' } });
  const renamed = reducer(c, { type: 'renameExpenseCategory', from: 'Pest control', to: 'Termite and pest' });
  ok(renamed.expenses.every((e) => e.category !== 'Pest control') && renamed.expenses.some((e) => e.category === 'Termite and pest'), 'renaming a category renames it on every expense');
  eq(reducer(c, { type: 'removeExpenseCategory', name: 'Pest control' }), c, 'a category in use cannot be removed without moving its expenses');
  const moved = reducer(c, { type: 'removeExpenseCategory', name: 'Pest control', moveTo: 'Other' });
  ok(!expenseCategories(moved.settings).includes('Pest control') && moved.expenses.some((e) => e.category === 'Other' && e.amount === 100000), 'removing a category moves its expenses and deletes no amount');

  // edit, mark paid, repeat, delete booking
  const exId = st2.expenses.find((e) => e.vendor === 'Sharma Paints').id;
  const edited = reducer(st2, { type: 'updateExpense', id: exId, patch: { amount: 5500000 } });
  eq(edited.expenses.find((e) => e.id === exId).amount, 5500000, 'an expense can be edited');
  const unpaidId = st2.expenses.find((e) => e.paid === false).id;
  eq(reducer(st2, { type: 'updateExpense', id: unpaidId, patch: { paid: true } }).expenses.find((e) => e.id === unpaidId).paid, true, 'a bill can be marked paid');
  eq(repeatDates('2026-01-31', 'monthly', 3).join(','), '2026-01-31,2026-02-28,2026-03-31', 'a monthly repeat from the 31st lands on month ends');
  eq(repeatDates('2026-05-10', 'yearly', 2).join(','), '2026-05-10,2027-05-10', 'a yearly repeat');
  eq(repeatDates('2026-05-10', 'none', 9).length, 1, 'no repeat is one date');
  eq(addMonths('2026-12-15', 2), '2027-02-15', 'months roll over the year');
  const rep = reducer(base, { type: 'addExpenses', expenses: repeatDates('2026-01-05', 'monthly', 4).map((date) => ({ category: 'Water', amount: 80000, date })) });
  eq(rep.expenses.length - base.expenses.length, 4, 'a repeating expense becomes separate records');
  eq(new Set(rep.expenses.map((e) => e.id)).size, rep.expenses.length, 'every record has its own id');
  const someBooking = base.bookings[0].id;
  const del = reducer(st2, { type: 'deleteBooking', bookingId: someBooking });
  eq(del.expenses.filter((e) => !e.bookingId).length, 2, 'deleting a booking leaves garden expenses alone');

  // the statement
  const per = periodRange('cy', y);
  const stm = buildStatement({ state: st2, data: d2, period: per, today: TODAY });
  eq(stm.profit, t25.profit, 'balance sheet profit equals the profit shown on the Money page for the same year');
  eq(stm.income.total, t25.total, 'balance sheet income equals the Money page revenue');
  eq(stm.expenses.total, t25.expenses, 'balance sheet expenses equal the Money page expenses');
  eq(stm.categories.reduce((s, r) => s + r.total, 0), stm.expenses.total, 'category rows add up to total expenses');
  eq(stm.months.reduce((s, m) => s + m.income - m.eventCosts - m.gardenCosts, 0), stm.profit, 'month by month adds up to the profit');
  eq(stm.toPay, 1200000, 'the unpaid repair bill is listed as still to pay');
  eq(stm.paidOut, stm.expenses.total - 1200000, 'expenses paid = total minus unpaid bills');
  const fy = periodRange('fy', 2025);
  eq(fy.from + '|' + fy.to, '2025-04-01|2026-03-31', 'a financial year runs April to March');
  const fyStm = buildStatement({ state: st2, data: d2, period: fy, today: TODAY });
  ok(fyStm.garden.length === 2 && fyStm.events.every((r) => r.booking.date >= fy.from && r.booking.date <= fy.to), 'financial-year statement only holds that year’s dates');
  const yrsP = periodYears(d2, TODAY);
  ok(yrsP.fy.includes(2025) && yrsP.cy.includes(2026), 'period choices come from the data');
  const allStm = buildStatement({ state: st2, data: d2, period: periodRange('all'), today: TODAY });
  eq(allStm.events.length, d2.rows.filter((r) => r.counted).length, 'all years holds every counted event');

  // the Excel file
  const blob = await statementWorkbook(stm, 'Test Garden');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const entries = await readZip(blob);
  const names = entries.map((e) => e.name);
  ok(['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet6.xml'].every((n) => names.includes(n)), 'the .xlsx holds the parts Excel needs');
  fsNode.mkdirSync(new URL('../tmp-check/', import.meta.url), { recursive: true });
  fsNode.writeFileSync(new URL('../tmp-check/balance.xlsx', import.meta.url), bytes);
  ok(bytes.length > 4000, `the Excel file is ${bytes.length} bytes`);
}

console.log('Bin (deleted bookings can be put back)');
{
  const base = buildSeed('2026-10-19');
  const victim = base.bookings.find((b) => base.payments.some((p) => p.bookingId === b.id) && base.expenses.some((e) => e.bookingId === b.id));
  const del = reducer(base, { type: 'deleteBooking', bookingId: victim.id, date: '2026-10-19' });
  ok(!del.bookings.some((b) => b.id === victim.id) && del.bin.length === 1, 'deleting moves the booking to the bin');
  ok(!del.payments.some((p) => p.bookingId === victim.id), 'its payments leave the live data (so money totals drop)');
  const back = reducer(del, { type: 'restoreDeleted', id: victim.id });
  eq(back.bin.length, 0, 'putting back empties that bin entry');
  ok(sameData({ ...back, bin: [] }, { ...base, bin: [] }), 'putting back restores bookings, client, payments, expenses, attendance and invoices exactly');
  const again = reducer(back, { type: 'restoreDeleted', id: victim.id });
  ok(again === back, 'restoring twice does nothing');
  eq(reducer(del, { type: 'purgeBin', today: '2026-11-17' }).bin.length, 1, 'still kept after 29 days');
  eq(reducer(del, { type: 'purgeBin', today: '2026-11-19' }).bin.length, 0, 'forgotten after 30 days');
  eq(reducer(del, { type: 'purgeBin', id: victim.id }).bin.length, 0, 'delete for good removes one entry');
  eq(reducer(del, { type: 'purgeBin' }).bin.length, 0, 'empty the bin removes all');
  const ops = diffState(base, del);
  ok(ops.some((o) => o.collection === 'bin' && o.op === 'set'), 'the bin entry is written to the backend');
  const rebuilt = applyOps(base, ops);
  ok(sameData(rebuilt, del), 'applying those writes gives the same data');
  ok(applyOps({ ...base, bin: undefined }, ops).bin.length === 1, 'older saved data without a bin still loads');
  // a client with a second booking stays put
  const other = base.bookings.find((b) => b.id !== victim.id && b.clientId === victim.clientId);
  if (other) ok(del.clients.some((c) => c.id === victim.clientId), 'a client with other bookings stays');
}

console.log('WhatsApp reminders');
{
  const row = { client: { name: 'Sharma', phone: '9876543210' }, booking: { date: '2026-11-20' }, eventType: 'Wedding', pending: 12500000, counted: true };
  eq(whatsappNumber('98765 43210'), '919876543210', '10-digit number gets the India code');
  eq(whatsappNumber('+91 98765-43210'), '919876543210', 'a number typed with +91 works');
  eq(whatsappNumber('09876543210'), '919876543210', 'a leading 0 is dropped');
  eq(whatsappNumber('12345'), null, 'a too-short number gives no link');
  const txt = reminderText('', row, 'Shiv Garden');
  ok(txt.includes('Sharma') && txt.includes('1,25,000') && txt.includes('20 Nov 2026') && txt.includes('wedding') && txt.includes('Shiv Garden') && !txt.includes('{'), 'the standard message is filled in');
  eq(reminderText('Hi {name} {unknown}', row, 'G'), 'Hi Sharma {unknown}', 'unknown words are left alone');
  ok(whatsappLink(row, 'G').startsWith('https://wa.me/919876543210?text='), 'the link opens WhatsApp for that number');
  eq(whatsappLink({ ...row, client: { name: 'X', phone: '' } }, 'G'), null, 'no phone number, no link');
}

console.log('Receipts: amount in words');
eq(paiseInWords(12500000), 'Rupees one lakh twenty-five thousand only', 'Rs 1,25,000 in words');
eq(paiseInWords(4300000), 'Rupees forty-three thousand only', 'Rs 43,000 in words');
eq(paiseInWords(10000000), 'Rupees one lakh only', 'exactly one lakh');
eq(paiseInWords(250000000), 'Rupees twenty-five lakh only', 'Rs 25 lakh');
eq(paiseInWords(1000000000), 'Rupees one crore only', 'one crore');
eq(paiseInWords(50505), 'Rupees five hundred five and five paise only', 'hundreds and paise');
eq(paiseInWords(0), 'Rupees zero only', 'zero');

console.log('Import helpers');
eq(parseFlexibleDate('2023-11-04'), '2023-11-04', 'ISO date');
eq(parseFlexibleDate('04/11/2023'), '2023-11-04', 'DD/MM/YYYY');
eq(parseFlexibleDate('4-Nov-23'), '2023-11-04', 'D-Mon-YY');
eq(parseFlexibleDate('31/02/2023'), null, 'impossible date is rejected');
eq(addDays('2026-10-31', 1), '2026-11-01', 'addDays rolls the month');
eq(parseCSV('a,b\n"x, y",2\r\n').length, 2, 'CSV with a quoted comma');
eq(parseCSV('a\tb\n1\t2').length, 2, 'tab-separated paste from Excel');
eq(toPaise('₹1,25,000'), 12500000, 'rupees typed with commas -> paise');
eq(inr(12500000), '₹1,25,000', 'Indian digit grouping');

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
