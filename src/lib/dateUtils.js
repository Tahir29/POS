// src/lib/dateUtils.js
// Small date helpers shared across forms/filters.

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
