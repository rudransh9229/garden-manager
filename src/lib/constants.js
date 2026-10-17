/** Starting list of booking types. The owner can add and remove types in Settings (stored in settings.eventTypes). */
export const DEFAULT_EVENT_TYPES = ['Wedding', 'Engagement', 'Reception', 'Birthday', 'Other'];
export const DOC_TYPES = ['Invoice', 'Agreement', 'ID proof', 'Receipt', 'Photo', 'Other'];
export const STATUSES = ['Enquiry', 'Tentative', 'Confirmed', 'Completed', 'Cancelled'];
export const EXPENSE_CATEGORIES = ['Decor', 'Catering', 'Electricity', 'Cleaning', 'Other'];
/** Labour is not typed in: it is worked out from attendance. */
export const CHART_CATEGORIES = ['Labour', ...EXPENSE_CATEGORIES];
export const PAYMENT_MODES = ['Cash', 'UPI', 'Bank transfer', 'Cheque'];
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
  // oldest year -> newest year, light -> dark green
  years: ['#7fc29c', '#58a97f', '#3b8f66', '#287451', '#185b40', '#0b432e'],
  // same idea for the expense pages, so green keeps meaning revenue and red keeps meaning expenses
  yearsExp: ['#ee9a90', '#e27c71', '#d15f53', '#bb4439', '#9a3128', '#7a241d'],
};
