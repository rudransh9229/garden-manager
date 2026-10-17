import { parseFlexibleDate, parseISO } from './dates.js';
import { MONTHS } from './format.js';

const monthIndex = (word) => MONTHS.findIndex((m) => m.toLowerCase() === word.slice(0, 3).toLowerCase());
const isMonthWord = (w) => /^[A-Za-z]{3,9}$/.test(w) && monthIndex(w) >= 0 && ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].includes(w.slice(0, 3).toLowerCase());

/**
 * Works out what the person typed. Anyone can type it the way they would say it:
 *   "Sharma"            -> client name (partial words are fine, any order)
 *   "98270"             -> part of a phone number
 *   "4 Nov 2023"        -> that exact day   (also 04/11/2023, 2023-11-04, 4-Nov-23)
 *   "4 Nov"             -> that day in every year
 *   "Nov 2023"          -> that month
 *   "2023"              -> that year
 *   "INV-2023-014"      -> the event that invoice belongs to
 * Returns a plain description so the screen can say what it understood.
 */
export function parseQuery(raw) {
  const q = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!q) return { kind: 'none' };
  const exact = parseFlexibleDate(q);
  if (exact) return { kind: 'date', date: exact };
  let m;
  if ((m = q.match(/^(\d{1,2}) ([A-Za-z]{3,9})$/)) && isMonthWord(m[2])) return { kind: 'dayMonth', day: +m[1], month: monthIndex(m[2]) + 1 };
  if ((m = q.match(/^([A-Za-z]{3,9}),? (\d{4})$/)) && isMonthWord(m[1])) return { kind: 'month', month: monthIndex(m[1]) + 1, year: +m[2] };
  if ((m = q.match(/^(\d{4}) ([A-Za-z]{3,9})$/)) && isMonthWord(m[2])) return { kind: 'month', month: monthIndex(m[2]) + 1, year: +m[1] };
  if (/^(19|20)\d{2}$/.test(q)) return { kind: 'year', year: +q };
  return { kind: 'text', tokens: q.toLowerCase().split(' ') };
}

export function describeQuery(p) {
  switch (p.kind) {
    case 'date': return `events on ${p.date.split('-').reverse().join('/')}`;
    case 'dayMonth': return `events on ${p.day} ${MONTHS[p.month - 1]} in any year`;
    case 'month': return `events in ${MONTHS[p.month - 1]} ${p.year}`;
    case 'year': return `events in ${p.year}`;
    case 'text': return `name, phone or notes matching "${p.tokens.join(' ')}"`;
    default: return '';
  }
}

/**
 * rows: from computeAll().rows. extra: Map(bookingId -> extra searchable text, e.g. invoice numbers).
 * Newest events first.
 */
export function searchRows(rows, rawQuery, extra) {
  const p = parseQuery(rawQuery);
  let out;
  if (p.kind === 'none') out = rows;
  else if (p.kind === 'date') out = rows.filter((r) => r.booking.date === p.date);
  else if (p.kind === 'dayMonth') out = rows.filter((r) => r.month === p.month && r.day === p.day);
  else if (p.kind === 'month') out = rows.filter((r) => r.month === p.month && r.year === p.year);
  else if (p.kind === 'year') out = rows.filter((r) => r.year === p.year);
  else {
    out = rows.filter((r) => {
      const hay = `${r.client.name} ${r.client.phone || ''} ${r.client.address || ''} ${r.booking.notes || ''} ${r.eventType} ${extra?.get(r.id) || ''}`.toLowerCase();
      return p.tokens.every((t) => hay.includes(t));
    });
  }
  return [...out].sort((a, b) => (a.booking.date < b.booking.date ? 1 : a.booking.date > b.booking.date ? -1 : 0));
}

export { parseISO };
