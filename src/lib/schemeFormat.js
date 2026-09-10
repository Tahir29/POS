// src/lib/schemeFormat.js
// Small display formatters shared across Schemes UI (enrollment cards,
// monthly schedule, payment history).

export function formatCurrency(n) {
  return `₹${Number(n ?? 0).toLocaleString('en-IN')}`;
}

export function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN');
}

// month_id is the CALENDAR month number (1-12), not a sequential
// instalment count — index 0 is a throwaway so month_id can index straight in.
export const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatMonthName(monthId) {
  return MONTH_NAMES[monthId] ?? `Month ${monthId}`;
}
