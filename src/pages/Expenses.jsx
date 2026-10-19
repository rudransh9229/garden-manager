import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { Confirm, Empty, Field, Icon, Kpi, Modal, MoneyInput, PageHead, SortTh, sortRows } from '../components/ui.jsx';
import { PAYMENT_MODES, REPEATS, catColor, expenseCategories } from '../lib/constants.js';
import { downloadText, toCSV } from '../lib/csv.js';
import { isValidISO, parseISO } from '../lib/dates.js';
import { fmtDate, inr, inrShort, MONTHS_LONG, plural, toPaise, toRupeesInput } from '../lib/format.js';
import { repeatDates } from '../lib/reducer.js';

const NEW_CATEGORY = '__new__';

/**
 * Every rupee the garden spends, in one place: painting, repairs, yearly bills, and the costs typed on an event's page.
 * Costs for one event are still entered on that event; this page is where garden-wide costs are entered and everything is searched.
 */
export default function Expenses() {
  const { state, data, dispatch, act, today } = useStore();
  const cats = expenseCategories(state.settings);
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [cat, setCat] = useState('all');
  const [scope, setScope] = useState('all'); // all | garden | events
  const [status, setStatus] = useState('all'); // all | paid | unpaid
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' });
  const [editing, setEditing] = useState(null); // null | 'new' | expense
  const [removing, setRemoving] = useState(null);

  const all = useMemo(() => state.expenses.map((e) => {
    const row = e.bookingId ? data.rowById.get(e.bookingId) : null;
    return { e, id: e.id, date: e.date, year: parseISO(e.date).y, category: e.category, amount: e.amount, vendor: e.vendor || '', note: e.note || '', paid: e.paid !== false, mode: e.mode || '', row, forWhat: row ? row.client.name : 'Garden' };
  }), [state.expenses, data.rowById]);

  const years = useMemo(() => [...new Set([thisYear, ...all.map((x) => x.year)])].sort((a, b) => a - b), [all, thisYear]);
  const usedCats = useMemo(() => [...new Set([...cats, ...all.map((x) => x.category)])], [cats, all]);
  const vendors = useMemo(() => [...new Set(all.map((x) => x.vendor).filter(Boolean))].sort(), [all]);

  const needle = q.trim().toLowerCase();
  const list = useMemo(() => all.filter((x) =>
    (year === 'all' || x.year === year)
    && (cat === 'all' || x.category === cat)
    && (scope === 'all' || (scope === 'garden' ? !x.row && !x.e.bookingId : !!x.e.bookingId))
    && (status === 'all' || (status === 'paid' ? x.paid : !x.paid))
    && (!needle || `${x.category} ${x.vendor} ${x.note} ${x.forWhat} ${x.mode}`.toLowerCase().includes(needle)),
  ), [all, year, cat, scope, status, needle]);
  const sorted = useMemo(() => sortRows(list, sort, {
    date: (x) => x.date, category: (x) => x.category.toLowerCase(), who: (x) => (x.vendor || x.note).toLowerCase(), forWhat: (x) => x.forWhat.toLowerCase(), amount: (x) => x.amount, paid: (x) => (x.paid ? 1 : 0),
  }), [list, sort]);

  const total = list.reduce((s, x) => s + x.amount, 0);
  const unpaid = list.filter((x) => !x.paid && x.date <= today); // a bill dated in the future is planned, not owed yet
  const unpaidTotal = unpaid.reduce((s, x) => s + x.amount, 0);
  const byCat = useMemo(() => {
    const m = new Map();
    for (const x of list) m.set(x.category, (m.get(x.category) || 0) + x.amount);
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [list]);
  const month = parseISO(today).m;
  const thisMonthTotal = all.filter((x) => x.year === thisYear && parseISO(x.date).m === month).reduce((s, x) => s + x.amount, 0);
  const labourNote = 'Staff wages are not listed here: they are worked out from attendance and counted on the event.';

  const exportCsv = () => downloadText(
    `expenses-${year}.csv`,
    toCSV([
      ['Date', 'Category', 'Paid to', 'Note', 'For', 'Payment mode', 'Status', 'Amount'],
      ...sorted.map((x) => [x.date, x.category, x.vendor, x.note, x.forWhat, x.mode, x.paid ? 'Paid' : 'Not paid yet', x.amount / 100]),
      ['Total', '', '', '', '', '', '', total / 100],
    ]),
  );

  return (
    <div className="page">
      <PageHead title="Expenses" sub="Everything the garden spends: painting, repairs, bills and yearly costs, plus costs entered on an event. They all count toward profit.">
        <button className="btn" onClick={exportCsv} disabled={!sorted.length}>Download as spreadsheet</button>
        <button className="btn primary" onClick={() => setEditing('new')}><Icon name="plus" />Add expense</button>
      </PageHead>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Kpi accent label={year === 'all' ? 'Spent, all years' : `Spent in ${year}`} value={inrShort(total)} sub={plural(list.length, 'expense')} />
        <Kpi label={`This month (${MONTHS_LONG[month - 1]})`} value={inrShort(thisMonthTotal)} sub="Garden and event costs together" />
        <Kpi label="Biggest cost" value={byCat[0] ? byCat[0].name : '—'} sub={byCat[0] ? `${inrShort(byCat[0].value)} · ${Math.round((byCat[0].value / total) * 100)}% of this view` : ''} />
        <Kpi label="Bills still to pay" value={inrShort(unpaidTotal)} tone={unpaidTotal ? 'bad' : ''} sub={unpaid.length ? plural(unpaid.length, 'bill') : 'Nothing waiting'} />
      </div>

      <div className="card" style={{ padding: '12px 16px', marginBottom: 16 }}>
        <div className="row">
          <label className="small muted" htmlFor="x-year">Year</label>
          <select id="x-year" value={year} onChange={(e) => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))} style={{ width: 'auto' }}>
            <option value="all">All years</option>
            {[...years].reverse().map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <label className="small muted" htmlFor="x-cat">Category</label>
          <select id="x-cat" value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">All categories</option>
            {usedCats.map((c) => <option key={c}>{c}</option>)}
          </select>
          <label className="small muted" htmlFor="x-scope">For</label>
          <select id="x-scope" value={scope} onChange={(e) => setScope(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">Garden and events</option>
            <option value="garden">Garden only</option>
            <option value="events">Events only</option>
          </select>
          <label className="small muted" htmlFor="x-status">Status</label>
          <select id="x-status" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">Paid and unpaid</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Not paid yet</option>
          </select>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search paid to, note, client" aria-label="Search expenses" style={{ minWidth: 220, flex: 1 }} />
        </div>
      </div>

      {all.length === 0 ? (
        <div className="card">
          <Empty title="No expenses yet" action={<button className="btn primary" onClick={() => setEditing('new')}>Add the first expense</button>}>
            Add painting, repairs, electricity bills or anything else the garden pays for. {labourNote}
          </Empty>
        </div>
      ) : (
        <div className="stack">
          <section className="card" aria-label="Spending by category">
            <div className="card-head"><div><h2>By category</h2><p>{year === 'all' ? 'All years' : year}. {labourNote}</p></div><Link className="btn small" to="/expenses">Expense graphs</Link></div>
            {byCat.length === 0 ? <p className="muted small">Nothing to show.</p> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '14px 24px' }}>
                {byCat.map((c) => (
                  <div key={c.name}>
                    <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                      <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: catColor(c.name, usedCats), marginRight: 8 }} />{c.name}</span>
                      <span className="num">{inr(c.value)}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: '#e3e6df', marginTop: 6 }} aria-hidden="true">
                      <div style={{ width: `${Math.max(2, Math.round((c.value / total) * 100))}%`, height: '100%', borderRadius: 3, background: catColor(c.name, usedCats) }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          <div className="card" style={{ padding: 8 }}>
            {sorted.length === 0 ? (
              <Empty title="Nothing matches">Try another year, category or search.</Empty>
            ) : (
              <div className="table-wrap">
                <table className="cards-sm">
                  <thead>
                    <tr>
                      <SortTh label="Date" k="date" sort={sort} setSort={setSort} />
                      <SortTh label="Category" k="category" sort={sort} setSort={setSort} />
                      <SortTh label="Paid to" k="who" sort={sort} setSort={setSort} />
                      <SortTh label="For" k="forWhat" sort={sort} setSort={setSort} />
                      <SortTh label="Amount" k="amount" sort={sort} setSort={setSort} right />
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.slice(0, 300).map((x) => (
                      <tr key={x.id}>
                        <td className="c-date num" style={{ whiteSpace: 'nowrap' }}>{fmtDate(x.date)}</td>
                        <td className="c-cat"><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: catColor(x.category, usedCats), marginRight: 8 }} />{x.category}</td>
                        <td className="c-who">
                          {x.vendor || <span className="faint hide-sm">—</span>}
                          {(x.note || x.mode) && <div className="small muted">{[x.note, x.mode].filter(Boolean).join(' · ')}</div>}
                          {!x.paid && <span className="pill Tentative" style={{ marginTop: 4 }}>Not paid yet</span>}
                        </td>
                        <td className="c-for">{x.row ? <Link to={`/events/${x.row.id}`}>{x.forWhat}</Link> : x.e.bookingId ? <span className="muted">Removed event</span> : 'Garden'}</td>
                        <td className="c-amt right num" style={{ fontWeight: 600 }}>{inr(x.amount)}</td>
                        <td className="c-act" style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                          {!x.paid && <button className="btn small" onClick={() => act({ type: 'updateExpense', id: x.id, patch: { paid: true } }, `${inr(x.amount)} marked as paid`)}>Mark paid</button>}{' '}
                          <button className="btn small" onClick={() => setEditing(x.e)}>Edit</button>{' '}
                          <button className="btn small danger" onClick={() => setRemoving(x)} aria-label={`Remove expense of ${inr(x.amount)}`}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ fontWeight: 700, padding: '12px 10px' }}>Total</td>
                      <td className="right num" style={{ fontWeight: 700 }}>{inr(total)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {sorted.length > 300 && <p className="small muted" style={{ padding: 12 }}>Showing 300 of {sorted.length}. Pick a year to narrow it, or download the spreadsheet for everything.</p>}
          </div>

        </div>
      )}

      {editing && (
        <ExpenseForm
          expense={editing === 'new' ? null : editing}
          cats={usedCats}
          vendors={vendors}
          today={today}
          onClose={() => setEditing(null)}
          onSave={(action, message) => { act(action, message); setEditing(null); }}
          onNewCategory={(name) => dispatch({ type: 'addExpenseCategory', name })}
        />
      )}
      {removing && (
        <Confirm title="Remove this expense?" confirmLabel="Remove" danger onConfirm={() => act({ type: 'deleteExpense', id: removing.id }, `${inr(removing.amount)} expense removed`)} onClose={() => setRemoving(null)}>
          <p>{inr(removing.amount)} for {removing.category}{removing.vendor ? ` (${removing.vendor})` : ''}, {fmtDate(removing.date)}. You can undo this right after.</p>
        </Confirm>
      )}
    </div>
  );
}

function ExpenseForm({ expense, cats, vendors, today, onClose, onSave, onNewCategory }) {
  const editing = !!expense;
  const isEvent = editing && !!expense.bookingId;
  const [f, setF] = useState(() => ({
    date: expense?.date || today,
    category: expense?.category || cats[0],
    newCategory: '',
    amount: expense ? toRupeesInput(expense.amount) : '',
    vendor: expense?.vendor || '',
    mode: expense?.mode || '',
    note: expense?.note || '',
    paid: expense ? expense.paid !== false : true,
    repeat: 'none',
    count: '12',
  }));
  const [touched, setTouched] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const amt = toPaise(f.amount);
  const creating = f.category === NEW_CATEGORY;
  const newName = f.newCategory.trim();
  const dup = creating && cats.some((c) => c.toLowerCase() === newName.toLowerCase());
  const reserved = creating && newName.toLowerCase() === 'labour';
  const errors = {
    amount: !amt ? 'Enter the amount.' : '',
    date: !isValidISO(f.date) ? 'Pick a valid date.' : '',
    category: creating ? (!newName ? 'Type a name for the new category.' : dup ? 'You already have this category.' : reserved ? '"Labour" is worked out from attendance. Pick another name.' : '') : '',
  };
  const invalid = Object.values(errors).some(Boolean);
  const dates = !editing && f.repeat !== 'none' && isValidISO(f.date) ? repeatDates(f.date, f.repeat, Number(f.count)) : [f.date];

  const save = () => {
    setTouched(true);
    if (invalid) return;
    let category = f.category;
    if (creating) { onNewCategory(newName); category = newName; }
    const fields = { category, amount: amt, vendor: f.vendor.trim(), mode: f.mode, note: f.note.trim(), paid: f.paid };
    if (editing) {
      onSave({ type: 'updateExpense', id: expense.id, patch: { ...fields, date: f.date } }, `${inr(amt)} expense saved`);
    } else if (dates.length > 1) {
      onSave({ type: 'addExpenses', expenses: dates.map((d, i) => ({ ...fields, bookingId: '', date: d, paid: i === 0 ? f.paid : false })) }, `${dates.length} expenses of ${inr(amt)} added`);
    } else {
      onSave({ type: 'addExpense', expense: { ...fields, bookingId: '', date: f.date } }, `${inr(amt)} expense added`);
    }
  };

  return (
    <Modal
      title={editing ? 'Edit expense' : 'Add an expense'}
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>{editing ? 'Save changes' : dates.length > 1 ? `Add ${dates.length} expenses` : 'Add expense'}</button></>}
    >
      {isEvent && <p className="small muted" style={{ marginBottom: 12 }}>This cost belongs to an event, so it stays with that event.</p>}
      <div className="form-grid">
        <Field label="Category" error={touched ? errors.category : undefined}>
          <select value={f.category} onChange={set('category')}>
            {(cats.includes(f.category) || creating ? cats : [f.category, ...cats]).map((c) => <option key={c}>{c}</option>)}
            <option value={NEW_CATEGORY}>+ New category…</option>
          </select>
        </Field>
        {creating ? (
          <Field label="New category name" error={touched ? errors.category : undefined}><input type="text" value={f.newCategory} onChange={set('newCategory')} placeholder="For example Generator fuel" autoFocus /></Field>
        ) : (
          <Field label="Amount" error={touched ? errors.amount : undefined}><MoneyInput value={f.amount} onChange={set('amount')} placeholder="0" /></Field>
        )}
        {creating && <Field label="Amount" error={touched ? errors.amount : undefined}><MoneyInput value={f.amount} onChange={set('amount')} placeholder="0" /></Field>}
        <Field label="Date" error={touched ? errors.date : undefined}><input type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label="Paid to" hint="Shop, painter or person. Optional.">
          <input type="text" value={f.vendor} onChange={set('vendor')} list="expense-vendors" placeholder="For example Sharma Paints" />
        </Field>
        <Field label="Payment mode">
          <select value={f.mode} onChange={set('mode')}><option value="">Not noted</option>{PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}</select>
        </Field>
        <Field label="Status">
          <select value={f.paid ? 'paid' : 'unpaid'} onChange={(e) => setF({ ...f, paid: e.target.value === 'paid' })}>
            <option value="paid">Paid</option>
            <option value="unpaid">Not paid yet (a bill to pay later)</option>
          </select>
        </Field>
        <Field label="Note" full><input type="text" value={f.note} onChange={set('note')} placeholder="Optional, for example front gate and boundary wall" /></Field>
        {!editing && (
          <>
            <Field label="Repeat" hint="For rent, insurance, monthly bills. Each date becomes its own expense you can edit.">
              <select value={f.repeat} onChange={set('repeat')}>{REPEATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </Field>
            {f.repeat !== 'none' && (
              <Field label="How many times" hint={`Dates: ${dates.slice(0, 3).map(fmtDate).join(', ')}${dates.length > 3 ? ` … ${fmtDate(dates[dates.length - 1])}` : ''}. The first uses the status above; the later ones start as not paid yet.`}>
                <input type="number" min="2" max="60" value={f.count} onChange={set('count')} />
              </Field>
            )}
          </>
        )}
      </div>
      <datalist id="expense-vendors">{vendors.map((v) => <option key={v} value={v} />)}</datalist>
    </Modal>
  );
}
