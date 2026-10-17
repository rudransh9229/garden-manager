import { parseISO } from './dates.js';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Money is stored as integer paise. These helpers format for people.
const grouped = (n) => Math.abs(n).toLocaleString('en-IN');
const trim = (n) => String(Number(n.toFixed(2)));

export function inr(paise) {
  const r = Math.round((paise || 0) / 100);
  return `${r < 0 ? '−' : ''}₹${grouped(r)}`;
}
/** ₹2.4 L / ₹1.2 Cr for big numbers on cards */
export function inrShort(paise) {
  const r = Math.round((paise || 0) / 100);
  const a = Math.abs(r);
  const s = r < 0 ? '−' : '';
  if (a >= 1e7) return `${s}₹${trim(a / 1e7)} Cr`;
  if (a >= 1e5) return `${s}₹${trim(a / 1e5)} L`;
  return `${s}₹${grouped(a)}`;
}
/** Compact axis tick: 50k, 2L, 1.2Cr */
export function axisInr(paise) {
  const a = Math.abs((paise || 0) / 100);
  if (a >= 1e7) return `${trim(a / 1e7)}Cr`;
  if (a >= 1e5) return `${trim(a / 1e5)}L`;
  if (a >= 1e3) return `${trim(a / 1e3)}k`;
  return String(Math.round(a));
}
/** "12500" or "₹12,500" typed by a person -> integer paise (NaN-safe: returns 0) */
export function toPaise(v) {
  const n = Number(String(v ?? '').replace(/[₹,\s]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
export const toRupeesInput = (paise) => (paise ? String(Math.round(paise) / 100) : '');

export function fmtDate(iso) {
  if (!iso) return '';
  const { y, m, d } = parseISO(iso);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
export function fmtDateShort(iso) {
  const { m, d } = parseISO(iso);
  return `${d} ${MONTHS[m - 1]}`;
}
export const fmtPhone = (p) => (p && p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p || '');
export function fmtPct(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return 'n/a';
  return `${n > 0 ? '+' : ''}${n.toFixed(0)}%`;
}
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
