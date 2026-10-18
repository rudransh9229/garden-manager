import { ATT_FACTOR, LABOUR, expenseCategories } from './constants.js';
import { addMonths } from './dates.js';

let counter = 0;
export const newId = (prefix) =>
  `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** An expense record. bookingId is '' for garden expenses (painting, repairs, yearly bills). paid=false means a bill still to pay. */
export const makeExpense = (e) => ({
  bookingId: '', vendor: '', mode: '', note: '', paid: true,
  ...e,
  id: e.id || newId('e'),
});

/** The dates a repeating expense falls on, starting with its own date. */
export function repeatDates(start, repeat, count) {
  const step = repeat === 'monthly' ? 1 : repeat === 'quarterly' ? 3 : repeat === 'yearly' ? 12 : 0;
  const n = step ? Math.max(1, Math.min(60, Math.floor(count) || 1)) : 1;
  return Array.from({ length: n }, (_, i) => addMonths(start, i * step));
}

const sumPayments = (state, bookingId) =>
  state.payments.filter((p) => p.bookingId === bookingId).reduce((s, p) => s + p.amount, 0);

/** Adds one booking (and its client / advance payment). Used by the booking form and the importer. */
export function addBookingTo(state, { client, booking, advance }) {
  let clients = state.clients;
  let clientId = client.id;
  if (!clientId) {
    const name = client.name.trim();
    const existing = clients.find(
      (c) => c.name.trim().toLowerCase() === name.toLowerCase() && (c.phone || '') === (client.phone || ''),
    );
    if (existing) clientId = existing.id;
    else {
      clientId = newId('c');
      clients = [...clients, { id: clientId, name, phone: client.phone || '', address: client.address || '' }];
    }
  }
  const bookingId = booking.id || newId('b');
  const b = { notes: '', guests: 0, ...booking, id: bookingId, clientId, source: booking.source || 'app' };
  const payments =
    advance && advance.amount > 0
      ? [...state.payments, { id: newId('p'), bookingId, amount: advance.amount, date: advance.date, mode: advance.mode || 'Cash', note: advance.note || 'Advance' }]
      : state.payments;
  return { ...state, clients, bookings: [...state.bookings, b], payments };
}

export function cancelBookingIn(state, { bookingId, choice, kept, reason, date, by }) {
  const b = state.bookings.find((x) => x.id === bookingId);
  if (!b || b.status === 'Cancelled') return state;
  const received = sumPayments(state, bookingId);
  const keptAmt =
    choice === 'full' ? received : choice === 'none' ? 0 : Math.max(0, Math.min(received, Math.round(kept || 0)));
  const old = state.cancellations.find((c) => c.bookingId === bookingId);
  const entry = {
    bookingId,
    cancelledAt: date,
    reason: reason || '',
    previousStatus: b.status,
    advanceReceived: received,
    advanceKept: keptAmt,
    refunded: received - keptAmt,
    restored: false,
    history: [...(old?.history || []), { at: date, by: by || 'owner', action: 'cancel', oldKept: 0, newKept: keptAmt }],
  };
  return {
    ...state,
    bookings: state.bookings.map((x) => (x.id === bookingId ? { ...x, status: 'Cancelled' } : x)),
    cancellations: [...state.cancellations.filter((c) => c.bookingId !== bookingId), entry],
  };
}

export function reducer(state, action) {
  switch (action.type) {
    case 'reset':
      return action.state;
    case 'setRole':
      return { ...state, role: action.role };

    case 'addBooking':
      return addBookingTo(state, action);
    case 'importBookings': {
      let s = state;
      for (const item of action.items) {
        s = addBookingTo(s, item);
        if (item.cancelled) {
          s = cancelBookingIn(s, {
            bookingId: item.booking.id,
            choice: 'part',
            kept: item.cancelled.kept,
            reason: item.cancelled.reason || 'Imported from old records',
            date: item.cancelled.date,
            by: 'import',
          });
        }
      }
      return s;
    }
    case 'updateBooking':
      return { ...state, bookings: state.bookings.map((b) => (b.id === action.id ? { ...b, ...action.fields } : b)) };
    case 'updateClient':
      return { ...state, clients: state.clients.map((c) => (c.id === action.id ? { ...c, ...action.fields } : c)) };

    case 'deleteBooking': {
      // Removes the booking and everything that hangs off it. The screen asks first and offers Undo.
      const b = state.bookings.find((x) => x.id === action.bookingId);
      if (!b) return state;
      const id = b.id;
      const bookings = state.bookings.filter((x) => x.id !== id);
      const clientStillUsed = bookings.some((x) => x.clientId === b.clientId);
      return {
        ...state,
        bookings,
        clients: clientStillUsed ? state.clients : state.clients.filter((c) => c.id !== b.clientId),
        payments: state.payments.filter((p) => p.bookingId !== id),
        expenses: state.expenses.filter((e) => e.bookingId !== id),
        attendance: state.attendance.filter((a) => a.bookingId !== id),
        documents: state.documents.filter((d) => d.bookingId !== id),
        cancellations: state.cancellations.filter((c) => c.bookingId !== id),
      };
    }

    case 'addEventType': {
      const name = String(action.name || '').trim();
      const types = state.settings.eventTypes;
      if (!name || types.some((t) => t.toLowerCase() === name.toLowerCase())) return state;
      return { ...state, settings: { ...state.settings, eventTypes: [...types, name] } };
    }
    case 'renameEventType': {
      const name = String(action.to || '').trim();
      const types = state.settings.eventTypes;
      if (!name || !types.includes(action.from)) return state;
      if (types.some((t) => t !== action.from && t.toLowerCase() === name.toLowerCase())) return state;
      return {
        ...state,
        settings: { ...state.settings, eventTypes: types.map((t) => (t === action.from ? name : t)) },
        bookings: state.bookings.map((b) => (b.eventType === action.from ? { ...b, eventType: name } : b)),
      };
    }
    case 'removeEventType': {
      // A type that bookings use can only be removed by moving those bookings to another type.
      const types = state.settings.eventTypes;
      if (types.length <= 1 || !types.includes(action.name)) return state;
      const inUse = state.bookings.some((b) => b.eventType === action.name);
      const target = action.moveTo;
      if (inUse && (!target || target === action.name || !types.includes(target))) return state;
      return {
        ...state,
        settings: { ...state.settings, eventTypes: types.filter((t) => t !== action.name) },
        bookings: inUse ? state.bookings.map((b) => (b.eventType === action.name ? { ...b, eventType: target } : b)) : state.bookings,
      };
    }

    case 'addPayment':
      return { ...state, payments: [...state.payments, { id: newId('p'), ...action.payment }] };
    case 'deletePayment':
      return { ...state, payments: state.payments.filter((p) => p.id !== action.id) };
    case 'addExpense':
      return { ...state, expenses: [...state.expenses, makeExpense(action.expense)] };
    case 'addExpenses': {
      // A garden expense that repeats (rent, insurance, a monthly bill): one ordinary record per date, each editable on its own.
      const list = (action.expenses || []).map(makeExpense);
      return list.length ? { ...state, expenses: [...state.expenses, ...list] } : state;
    }
    case 'updateExpense': {
      if (!state.expenses.some((e) => e.id === action.id)) return state;
      return { ...state, expenses: state.expenses.map((e) => (e.id === action.id ? { ...e, ...action.patch, id: e.id } : e)) };
    }
    case 'deleteExpense':
      return { ...state, expenses: state.expenses.filter((e) => e.id !== action.id) };

    case 'addExpenseCategory': {
      const name = String(action.name || '').trim();
      const cats = expenseCategories(state.settings);
      if (!name || name.toLowerCase() === LABOUR.toLowerCase() || cats.some((c) => c.toLowerCase() === name.toLowerCase())) return state;
      return { ...state, settings: { ...state.settings, expenseCategories: [...cats, name] } };
    }
    case 'renameExpenseCategory': {
      const name = String(action.to || '').trim();
      const cats = expenseCategories(state.settings);
      if (!name || !cats.includes(action.from) || name.toLowerCase() === LABOUR.toLowerCase()) return state;
      if (cats.some((c) => c !== action.from && c.toLowerCase() === name.toLowerCase())) return state;
      return {
        ...state,
        settings: { ...state.settings, expenseCategories: cats.map((c) => (c === action.from ? name : c)) },
        expenses: state.expenses.map((e) => (e.category === action.from ? { ...e, category: name } : e)),
      };
    }
    case 'removeExpenseCategory': {
      // A category with expenses can only be removed by moving those expenses to another category.
      const cats = expenseCategories(state.settings);
      if (cats.length <= 1 || !cats.includes(action.name)) return state;
      const inUse = state.expenses.some((e) => e.category === action.name);
      const target = action.moveTo;
      if (inUse && (!target || target === action.name || !cats.includes(target))) return state;
      return {
        ...state,
        settings: { ...state.settings, expenseCategories: cats.filter((c) => c !== action.name) },
        expenses: inUse ? state.expenses.map((e) => (e.category === action.name ? { ...e, category: target } : e)) : state.expenses,
      };
    }

    case 'cancelBooking':
      return cancelBookingIn(state, action);
    case 'restoreBooking': {
      const c = state.cancellations.find((x) => x.bookingId === action.bookingId && !x.restored);
      if (!c) return state;
      return {
        ...state,
        bookings: state.bookings.map((b) => (b.id === action.bookingId ? { ...b, status: c.previousStatus } : b)),
        cancellations: state.cancellations.map((x) =>
          x === c
            ? { ...x, restored: true, history: [...x.history, { at: action.date, by: action.by || 'owner', action: 'restore', oldKept: x.advanceKept, newKept: 0 }] }
            : x,
        ),
      };
    }
    case 'editCancellation': {
      return {
        ...state,
        cancellations: state.cancellations.map((x) => {
          if (x.bookingId !== action.bookingId || x.restored) return x;
          const kept = Math.max(0, Math.min(x.advanceReceived, Math.round(action.kept)));
          return {
            ...x,
            advanceKept: kept,
            refunded: x.advanceReceived - kept,
            history: [...x.history, { at: action.date, by: action.by || 'owner', action: 'edit', oldKept: x.advanceKept, newKept: kept }],
          };
        }),
      };
    }

    case 'setAttendance': {
      const staff = state.staff.find((s) => s.id === action.staffId);
      if (!staff) return state;
      const wageApplied = Math.round(staff.dailyWage * ATT_FACTOR[action.status]);
      const exists = state.attendance.find((a) => a.bookingId === action.bookingId && a.staffId === action.staffId);
      const rec = { bookingId: action.bookingId, staffId: action.staffId, status: action.status, wageApplied, wageFor: action.status, markedBy: action.by || 'owner', note: action.note ?? exists?.note ?? '' };
      return {
        ...state,
        attendance: exists
          ? state.attendance.map((a) => (a === exists ? { ...exists, ...rec } : a))
          : [...state.attendance, { id: newId('a'), ...rec }],
      };
    }
    case 'fixWages': {
      // Owner only. A manager marks attendance without ever seeing wages, so the day's pay is worked out here,
      // by an owner's device, whenever a mark has no pay yet or was changed since the pay was worked out.
      const wage = new Map(state.staff.map((x) => [x.id, x.dailyWage || 0]));
      let changed = false;
      const attendance = state.attendance.map((a) => {
        if (a.wageApplied !== undefined && a.wageFor === a.status) return a;
        changed = true;
        return { ...a, wageApplied: Math.round((wage.get(a.staffId) || 0) * ATT_FACTOR[a.status]), wageFor: a.status };
      });
      return changed ? { ...state, attendance } : state;
    }
    case 'removeAttendance':
      return { ...state, attendance: state.attendance.filter((a) => !(a.bookingId === action.bookingId && a.staffId === action.staffId)) };

    case 'addStaff':
      return { ...state, staff: [...state.staff, { id: newId('s'), active: true, ...action.staff }] };
    case 'updateStaff':
      return { ...state, staff: state.staff.map((s) => (s.id === action.id ? { ...s, ...action.fields } : s)) };

    case 'addDocument':
      return { ...state, documents: [...state.documents, { id: newId('d'), ...action.doc }] };
    case 'updateDocument':
      return { ...state, documents: state.documents.map((d) => (d.id === action.id ? { ...d, ...action.fields } : d)) };
    case 'deleteDocument':
      return { ...state, documents: state.documents.filter((d) => d.id !== action.id) };

    case 'setSettings':
      return { ...state, settings: { ...state.settings, ...action.fields } };
    default:
      return state;
  }
}
