import { fmtDate, inr } from './format.js';

/** The message used when the owner has not written their own. {name} {amount} {date} {event} {garden} are filled in. */
export const DEFAULT_REMINDER =
  'Namaste {name} ji, this is a gentle reminder from {garden}. ₹{amount} is still pending for your {event} on {date}. Please let us know when you can pay. Thank you!';

/** A phone number as WhatsApp wants it: digits only, with the country code (India, 91, when there are 10 digits). Null if it cannot work. */
export function whatsappNumber(phone) {
  let d = String(phone || '').replace(/\D/g, '').replace(/^00/, '');
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = `91${d}`;
  return d.length >= 11 && d.length <= 15 ? d : null;
}

/** Fills the message for one event. `row` is a computed row (client, booking, pending). */
export function reminderText(template, row, gardenName) {
  const amount = inr(row.pending).replace('₹', '');
  const vars = {
    name: row.client.name,
    amount,
    date: fmtDate(row.booking.date),
    event: String(row.eventType || 'event').toLowerCase(),
    garden: gardenName || 'the garden',
  };
  return String(template || DEFAULT_REMINDER).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

/** A wa.me link that opens WhatsApp with the message ready to send. Null when the client has no usable number. */
export function whatsappLink(row, gardenName, template) {
  const n = whatsappNumber(row.client.phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(reminderText(template, row, gardenName))}` : null;
}
