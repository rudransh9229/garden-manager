import { mulberry32 } from '../lib/rng.js';
import { parseISO, isoFrom, addDays, daysInMonth } from '../lib/dates.js';
import { ATT_FACTOR, DEFAULT_EVENT_TYPES, DEFAULT_EXPENSE_CATEGORIES } from '../lib/constants.js';

/**
 * Demo data only. All names, phone numbers and amounts are invented.
 * Six years of events, so the graphs and search have something real to show.
 * Money is in paise (1 rupee = 100 paise).
 */
const FIRST = ['Rajesh', 'Sunil', 'Anil', 'Vikram', 'Manoj', 'Deepak', 'Sanjay', 'Ramesh', 'Ashok', 'Pradeep', 'Naveen', 'Mukesh', 'Rakesh', 'Dinesh', 'Alok', 'Harish', 'Kapil', 'Yogesh', 'Suresh', 'Amit', 'Neeraj', 'Gaurav', 'Pankaj', 'Lalit', 'Sandeep', 'Mahesh', 'Vinod', 'Arun', 'Rohit', 'Nitin', 'Sunita', 'Meena', 'Kavita', 'Anita', 'Seema', 'Rekha', 'Pooja', 'Neha', 'Shweta', 'Priyanka'];
const LAST = ['Sharma', 'Verma', 'Patel', 'Joshi', 'Gupta', 'Mishra', 'Tiwari', 'Chouhan', 'Rathore', 'Jain', 'Agrawal', 'Soni', 'Yadav', 'Dubey', 'Pandey', 'Malviya', 'Solanki', 'Bhatt', 'Choudhary', 'Saxena', 'Parmar', 'Kushwaha', 'Mandloi', 'Nagar'];
const TOWNS = ['Indore', 'Dewas', 'Ujjain', 'Ratlam', 'Mhow', 'Dhar', 'Khandwa'];
const NOTES = ['Sangeet the night before', 'DJ arranged by the family', 'Needs extra parking for buses', 'Own decorator for the stage', 'Vegetarian catering only', 'Baraat arrives at 8 pm', 'Photographer needs early access', 'Two-day booking, second day is the reception'];
const STAFF = [
  ['Ramesh Kushwaha', 'Cook', 900], ['Mohan Lal', 'Cook', 850], ['Sita Bai', 'Helper', 500], ['Kamla Devi', 'Cleaner', 450],
  ['Bablu Khan', 'Waiter', 600], ['Imran Ali', 'Waiter', 600], ['Deepu Yadav', 'Waiter', 600], ['Sonu Bhil', 'Waiter', 550],
  ['Pappu Rathore', 'Decorator', 900], ['Lakhan Singh', 'Decorator', 800], ['Raju Parmar', 'Security', 700], ['Bhura Singh', 'Security', 700],
  ['Salim Sheikh', 'Electrician', 1000], ['Gopal Nai', 'Helper', 500], ['Munna Lal', 'Helper', 500], ['Santosh Barde', 'Waiter', 600],
  ['Geeta Bai', 'Cleaner', 450], ['Jitu Panwar', 'Helper', 500],
];
// Wedding months are heavy in Nov-Feb and again in Apr-Jun; the monsoon is quiet.
const MONTH_WEIGHT = [1.0, 0.9, 0.35, 0.55, 0.7, 0.6, 0.1, 0.1, 0.2, 0.9, 1.5, 1.6];
const SUM_W = MONTH_WEIGHT.reduce((a, b) => a + b, 0);
const PRICE = { Wedding: [220000, 420000], Engagement: [70000, 140000], Reception: [140000, 240000], Birthday: [35000, 70000], Other: [25000, 60000] };
const GUESTS = { Wedding: [400, 1200], Engagement: [150, 400], Reception: [300, 800], Birthday: [60, 200], Other: [50, 200] };
const CREW = { Wedding: [14, 18], Reception: [10, 14], Engagement: [8, 12], Birthday: [5, 8], Other: [5, 8] };

export function defaultSettings() {
  return {
    gardenName: 'Marriage Garden',
    eventTypes: [...DEFAULT_EVENT_TYPES],
    expenseCategories: [...DEFAULT_EXPENSE_CATEGORIES],
    seasons: [
      { name: 'Peak', months: [10, 11, 12, 1, 2] },
      { name: 'Summer', months: [3, 4, 5, 6] },
      { name: 'Monsoon', months: [7, 8, 9] },
    ],
  };
}

/** A clean start for real use: no demo clients, bookings, staff or invoices. Booking types and seasons are kept. */
export function emptyState(settings = defaultSettings(), today = '') {
  return {
    version: 1, role: 'owner', seededOn: today, settings,
    clients: [], bookings: [], payments: [], expenses: [], cancellations: [], staff: [], attendance: [], documents: [],
  };
}

export function buildSeed(today) {
  const rnd = mulberry32(2026);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const pct = (a, b) => a + rnd() * (b - a);
  const round = (n, step) => Math.round(n / step) * step;
  const pickW = (pairs) => {
    let t = rnd() * pairs.reduce((s, p) => s + p[1], 0);
    for (const [v, w] of pairs) if ((t -= w) <= 0) return v;
    return pairs[0][0];
  };
  const RUPEE_1000 = 100000; // paise
  const RUPEE_100 = 10000;

  const { y: ty } = parseISO(today);
  const startYear = ty - 5;
  const endISO = addDays(today, 150);
  const used = new Set();
  const dates = [];

  for (let y = startYear; y <= parseISO(endISO).y; y++) {
    const perYear = 20 + 3 * (y - startYear);
    for (let m = 1; m <= 12; m++) {
      if (isoFrom(y, m, 1) > endISO) break;
      const count = Math.max(0, Math.round((perYear * MONTH_WEIGHT[m - 1]) / SUM_W + (rnd() - 0.5) * 1.6));
      for (let k = 0; k < count; k++) {
        for (let tries = 0; tries < 20; tries++) {
          const iso = isoFrom(y, m, ri(1, daysInMonth(y, m)));
          if (iso > endISO || used.has(iso)) continue;
          used.add(iso);
          dates.push(iso);
          break;
        }
      }
    }
  }
  // Make sure the demo always has something happening around today (for the attendance screens).
  const forced = { [-3]: 'Completed', 0: 'Confirmed', 2: 'Confirmed', 5: 'Confirmed', 12: 'Confirmed' };
  const forcedStatus = new Map();
  for (const [off, st] of Object.entries(forced)) {
    const iso = addDays(today, Number(off));
    forcedStatus.set(iso, st);
    if (!used.has(iso)) { used.add(iso); dates.push(iso); }
  }
  dates.sort();

  const clients = [], bookings = [], payments = [], expenses = [], cancellations = [], attendance = [], documents = [];
  let cid = 0, bid = 0, pid = 0, eid = 0, aid = 0, did = 0;
  const invoiceSeq = {};
  const staff = STAFF.map(([name, role, wage], i) => ({
    id: `s${i + 1}`, name, role, phone: `9000${String(100000 + i * 7919).slice(0, 6)}`, dailyWage: wage * 100, active: true,
  }));

  const addPayment = (bookingId, amount, date, note) => {
    if (amount <= 0 || date > today) return 0;
    payments.push({ id: `p${++pid}`, bookingId, amount, date, mode: pickW([['Cash', 3], ['UPI', 4], ['Bank transfer', 2], ['Cheque', 1]]), note });
    return amount;
  };

  for (const date of dates) {
    const { y } = parseISO(date);
    const yi = y - startYear;
    const type = pickW([['Wedding', 0.5], ['Engagement', 0.12], ['Reception', 0.16], ['Birthday', 0.12], ['Other', 0.1]]);

    let client;
    if (clients.length > 8 && rnd() < 0.08) client = pick(clients);
    else {
      client = { id: `c${++cid}`, name: `${pick(FIRST)} ${pick(LAST)}`, phone: `9000${ri(100000, 999999)}`, address: pick(TOWNS) };
      clients.push(client);
    }

    const [lo, hi] = PRICE[type];
    const total = round((lo + rnd() * (hi - lo)) * (1 + 0.06 * yi), 1000) * 100;
    const guests = round(GUESTS[type][0] + rnd() * (GUESTS[type][1] - GUESTS[type][0]), 50);
    const past = date < today;
    const r = rnd();
    let status = forcedStatus.get(date);
    if (!status) {
      status = past
        ? r < 0.06 ? 'Cancelled' : 'Completed'
        : r < 0.05 ? 'Cancelled' : r < 0.12 ? 'Enquiry' : r < 0.28 ? 'Tentative' : 'Confirmed';
    }

    const id = `b${++bid}`;
    let bookedOn = addDays(date, -ri(45, 160));
    if (bookedOn > today) bookedOn = addDays(today, -ri(1, 25));
    if (bookedOn > date) bookedOn = date;

    const adv = round(total * pct(0.25, 0.4), RUPEE_1000);
    let received = 0;

    if (status === 'Completed') {
      received += addPayment(id, adv, bookedOn, 'Advance');
      const second = round(total * pct(0.3, 0.4), RUPEE_1000);
      const secondDate = addDays(date, -ri(10, 35));
      received += addPayment(id, second, secondDate < bookedOn ? addDays(bookedOn, 1) : secondDate, 'Second instalment');
      let final = total - adv - second;
      if (rnd() < 0.08) final -= round(total * pct(0.03, 0.1), RUPEE_1000); // a few small dues left over
      if (final > 0) received += addPayment(id, final, addDays(date, -ri(0, 3)), 'Final payment');
    } else if (status === 'Confirmed') {
      received += addPayment(id, adv, bookedOn, 'Advance');
      const until = Math.round((Date.parse(date) - Date.parse(today)) / 86400000);
      if (until <= 90 && rnd() < 0.6) received += addPayment(id, round(total * 0.3, RUPEE_1000), addDays(today, -ri(0, 20)), 'Second instalment');
      if (until <= 10 && rnd() < 0.5 && received < total) received += addPayment(id, total - received, addDays(today, -ri(0, 3)), 'Final payment');
    } else if (status === 'Tentative') {
      if (rnd() < 0.5) received += addPayment(id, round(total * 0.1, RUPEE_1000), addDays(today, -ri(1, 15)), 'Token amount');
    } else if (status === 'Cancelled') {
      received += addPayment(id, adv, bookedOn, 'Advance');
      if (rnd() < 0.3) received += addPayment(id, round(total * 0.3, RUPEE_1000), addDays(bookedOn, ri(5, 20)), 'Second instalment');
      const roll = rnd();
      const kept = roll < 0.6 ? received : roll < 0.85 ? round(received * pct(0.4, 0.7), RUPEE_1000) : 0;
      let at = past ? addDays(date, -ri(7, 45)) : addDays(today, -ri(1, 30));
      if (at <= bookedOn) at = addDays(bookedOn, 1);
      if (at > today) at = today;
      if (at > date) at = date;
      cancellations.push({
        bookingId: id, cancelledAt: at, reason: pick(['Date changed by the family', 'Booked another venue', 'Wedding postponed', 'Family issue']),
        previousStatus: 'Confirmed', advanceReceived: received, advanceKept: kept, refunded: received - kept, restored: false,
        history: [{ at, by: 'owner', action: 'cancel', oldKept: 0, newKept: kept }],
      });
    }

    bookings.push({
      id, clientId: client.id, eventType: type, date, guests, status, total,
      notes: rnd() < 0.35 ? pick(NOTES) : '',
      source: date < `${ty - 1}-01-01` ? 'imported' : 'app',
    });

    if (status === 'Completed') {
      const decor = type === 'Birthday' || type === 'Other' ? pct(0.03, 0.06) : pct(0.06, 0.12);
      const lines = [
        ['Decor', total * decor, 'Flowers and stage'],
        ['Catering', rnd() < 0.45 ? total * pct(0.15, 0.25) : 0, 'In-house catering'],
        ['Electricity', total * pct(0.015, 0.03), 'Power and generator diesel'],
        ['Cleaning', total * pct(0.01, 0.022), 'Cleaning after the event'],
        ['Other', total * pct(0.005, 0.02), 'Miscellaneous'],
      ];
      for (const [category, amt, note] of lines) {
        const amount = round(amt, RUPEE_100);
        if (amount <= 0) continue;
        const d = addDays(date, ri(0, 1));
        expenses.push({ id: `e${++eid}`, bookingId: id, category, amount, date: d > today ? today : d, note });
      }
      const [cl, ch] = CREW[type];
      const crew = [...staff].sort(() => rnd() - 0.5).slice(0, Math.min(staff.length, ri(cl, ch)));
      for (const s of crew) {
        const roll = rnd();
        const st = roll < 0.86 ? 'present' : roll < 0.92 ? 'half' : 'absent';
        attendance.push({ id: `a${++aid}`, bookingId: id, staffId: s.id, status: st, wageApplied: Math.round(s.dailyWage * ATT_FACTOR[st]), wageFor: st, markedBy: 'manager', note: '' });
      }
      // Most past events have their invoice kept on file; a few were never scanned.
      if (rnd() < 0.8) {
        const seq = String(++invoiceSeq[y] || (invoiceSeq[y] = 1)).padStart(3, '0');
        const number = `INV-${y}-${seq}`;
        documents.push({ id: `d${++did}`, bookingId: id, name: `${number}.pdf`, type: 'Invoice', number, uploadedAt: addDays(date, ri(0, 5)), demo: true });
      }
    }
  }

  return {
    version: 1,
    role: 'owner',
    seededOn: today,
    settings: defaultSettings(),
    clients, bookings, payments, expenses, cancellations, staff, attendance, documents,
  };
}
