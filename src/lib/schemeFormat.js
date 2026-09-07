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

// ADDED 2026-09-08 — SchemeMonthlyDetailsRow's own `month_id` (confirmed
// live) is the CALENDAR month number, 1–12 (see
// useSchemeMonthlyDetails.js's own header) — not a sequential instalment
// count. EnrollmentDetailSheet's Schedule tab used to display the bare
// number as "Month 9", which reads as "the 9th instalment" rather than
// "September" and was confusing next to a due date that's ALSO in
// September — this resolves it to the real name instead. Index 0 is a
// throwaway so month_id (1-indexed) can index straight in.
export const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatMonthName(monthId) {
  return MONTH_NAMES[monthId] ?? `Month ${monthId}`;
}
