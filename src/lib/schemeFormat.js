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
