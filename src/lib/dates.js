// All dates in the app are ISO strings "YYYY-MM-DD" (no time zones, no Date objects stored).
export const pad = (n) => String(n).padStart(2, '0');

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}
export const isoFrom = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const toUTC = (iso) => {
  const { y, m, d } = parseISO(iso);
  return Date.UTC(y, m - 1, d);
};
export function addDays(iso, n) {
  const t = new Date(toUTC(iso) + n * 86400000);
  return isoFrom(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
/** Same day number n months later (a 31st lands on the last day of a shorter month). */
export function addMonths(iso, n) {
  const { y, m, d } = parseISO(iso);
  const t = y * 12 + (m - 1) + n;
  const ny = Math.floor(t / 12);
  const nm = (t % 12) + 1;
  return isoFrom(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}
/** a - b in whole days */
export const diffDays = (a, b) => Math.round((toUTC(a) - toUTC(b)) / 86400000);
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** 0 = Sunday */
export const weekday = (iso) => new Date(toUTC(iso)).getUTCDay();
export function todayISO() {
  const t = new Date();
  return isoFrom(t.getFullYear(), t.getMonth() + 1, t.getDate());
}
export function isValidISO(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const { y, m, d } = parseISO(iso);
  return y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** Accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, "4 Nov 2023", "04-Nov-23". Returns ISO or null. */
export function parseFlexibleDate(input) {
  const s = String(input ?? '').trim();
  if (!s) return null;
  let m;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) {
    const iso = isoFrom(+m[1], +m[2], +m[3]);
    return isValidISO(iso) ? iso : null;
  }
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/))) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    const iso = isoFrom(y, +m[2], +m[1]);
    return isValidISO(iso) ? iso : null;
  }
  if ((m = s.match(/^(\d{1,2})[\s-]+([A-Za-z]{3,9})[\s,-]+(\d{2}|\d{4})$/))) {
    const mi = MON.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mi < 0) return null;
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    const iso = isoFrom(y, mi + 1, +m[1]);
    return isValidISO(iso) ? iso : null;
  }
  return null;
}
