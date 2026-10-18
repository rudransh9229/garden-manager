/** Starting list of booking types. The owner can add and remove types in Settings (stored in settings.eventTypes). */
export const DEFAULT_EVENT_TYPES = ['Wedding', 'Engagement', 'Reception', 'Birthday', 'Other'];
export const DOC_TYPES = ['Invoice', 'Agreement', 'ID proof', 'Receipt', 'Photo', 'Other'];
export const STATUSES = ['Enquiry', 'Tentative', 'Confirmed', 'Completed', 'Cancelled'];
/**
 * Starting list of expense categories. The owner adds, renames and removes them in Settings
 * (stored in settings.expenseCategories). Older saved data has no list yet, so expenseCategories() falls back to this.
 */
export const DEFAULT_EXPENSE_CATEGORIES = [
  'Decor', 'Catering', 'Electricity', 'Cleaning', 'Painting', 'Repairs and maintenance', 'Water',
  'Garden and plants', 'Furniture and equipment', 'Permanent staff salary', 'Licence, tax and insurance', 'Marketing', 'Other',
];
export const EXPENSE_CATEGORIES = DEFAULT_EXPENSE_CATEGORIES;
export const expenseCategories = (settings) => (settings && Array.isArray(settings.expenseCategories) && settings.expenseCategories.length ? settings.expenseCategories : DEFAULT_EXPENSE_CATEGORIES);
/** Labour is not typed in: it is worked out from attendance. The word is reserved. */
export const LABOUR = 'Labour';
export const CHART_CATEGORIES = [LABOUR, ...DEFAULT_EXPENSE_CATEGORIES];
export const PAYMENT_MODES = ['Cash', 'UPI', 'Bank transfer', 'Cheque'];
/** How often a garden expense repeats when the owner asks for "repeat". Entries are ordinary records afterwards. */
export const REPEATS = [['none', 'Does not repeat'], ['monthly', 'Every month'], ['quarterly', 'Every 3 months'], ['yearly', 'Every year']];
export const STAFF_ROLES = ['Waiter', 'Cook', 'Cleaner', 'Decorator', 'Security', 'Electrician', 'Helper'];

export const ATTENDANCE_STATES = ['present', 'half', 'absent'];
export const ATT_LABEL = { present: 'Present', half: 'Half day', absent: 'Absent' };
export const ATT_FACTOR = { present: 1, half: 0.5, absent: 0 };
/** The manager can only change attendance for events this many days back (owners: any time). */
export const MANAGER_EDIT_DAYS = 7;

/**
 * Chart colours. The categorical ones come from a validated colour-blind-safe set
 * (see DESIGN.md, "Chart colours"). Colour follows the thing it stands for, on every chart.
 */
export const COLORS = {
  revenue: '#008300',
  cancel: '#2a78d6',
  pending: '#eda100',
  expenses: '#e34948',
  profit: '#18231d',
  cats: {
    Labour: '#2a78d6',
    Decor: '#eb6834',
    Catering: '#1baf7a',
    Electricity: '#eda100',
    Cleaning: '#e87ba4',
    Other: '#6250d6',
  },
  // For categories the owner adds. Names are always shown next to the colour, so colour is never the only cue.
  extraCats: ['#0f8b8d', '#a05195', '#c4a000', '#7a5230', '#4c6ef5', '#8d6e63', '#2e7d32', '#ad1457', '#546e7a', '#ef6c00'],
  // oldest year -> newest year, light -> dark green
  years: ['#7fc29c', '#58a97f', '#3b8f66', '#287451', '#185b40', '#0b432e'],
  // same idea for the expense pages, so green keeps meaning revenue and red keeps meaning expenses
  yearsExp: ['#ee9a90', '#e27c71', '#d15f53', '#bb4439', '#9a3128', '#7a241d'],
};

/** One colour per category, stable for the whole list: known names keep their colour, the rest take turns. */
export function catColor(name, categories) {
  if (COLORS.cats[name]) return COLORS.cats[name];
  const extras = categories.filter((c) => !COLORS.cats[c]);
  const i = Math.max(0, extras.indexOf(name));
  return COLORS.extraCats[i % COLORS.extraCats.length];
}
