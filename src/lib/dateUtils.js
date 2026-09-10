// src/lib/dateUtils.js

/**
 * Today's date as YYYY-MM-DD in the browser's LOCAL timezone — use as the
 * `max` on <input type="date"> to block future dates.
 *
 * Deliberately NOT `new Date().toISOString().split('T')[0]`: toISOString()
 * converts to UTC first, which silently rolls back to "yesterday" for any
 * IST (UTC+5:30) user before ~5:30am local time.
 */
export function todayDateString() {
  const d    = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Five distinct display styles, each its own named export (a list row's
// compact "8 Sep" vs. a detail sheet's full "08 Sep 2026" are genuinely
// different contexts). "Missing" behavior differs by function ON PURPOSE —
// see each function's own doc comment.

/** "9/8/2026" — locale-default numeric. Missing → null; unparseable → the
 *  raw input back (never silently prints "Invalid Date"). */
export function formatDateNumeric(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN');
}

/** "08 Sep 2026" — day zero-padded, month short, year numeric.
 *  Missing → '—'; unparseable → the raw input back. */
export function formatDatePadded(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** "8 Sep 2026" — day numeric (not padded), month short, year numeric.
 *  Missing/unparseable → null. */
export function formatDateShort(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "8 Sep" — day numeric, month short, no year. Missing → null. */
export function formatDateCompact(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** "08/09/2026" — day/month/year all 2-digit numeric. Missing → null. */
export function formatDateSlashed(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
