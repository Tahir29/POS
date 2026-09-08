import APP_CONFIG from '@/constants/appConfig';

/**
 * Formats an amount as an INR currency string, or null for missing/zero/NaN
 * amounts — callers use the null to show a "not available" state instead of
 * a misleading ₹0.
 * @param {number|string|null|undefined} amount
 * @returns {string|null}
 */
export function formatPrice(amount) {
  if (amount === null || amount === undefined) return null;
  const num = parseFloat(amount);
  if (isNaN(num) || num === 0) return null;
  return new Intl.NumberFormat('en-IN', {
    style:                'currency',
    currency:             APP_CONFIG.CURRENCY.INR_CODE ?? 'INR',
    // FIXED 2026-09-08 — was maximumFractionDigits: 0, silently rounding
    // this to a whole rupee (e.g. ₹52,758.61 → ₹52,759) while
    // PriceBreakdown right below it on the same page shows the exact
    // figure (₹52,758.61) for the SAME field (livePricing.sub_total) —
    // confirmed by tracing both back to one source, not two different
    // prices. Unlike checkout/CartSummary's Total, there's no OrnaVerse
    // document being finalized here that needs a whole-rupee round_off
    // adjustment (see that fix's own header) — this is just a display
    // figure, so it now shows the same precision everywhere else in the
    // app already uses (maximumFractionDigits: 2), matching the
    // breakdown instead of silently disagreeing with it.
    maximumFractionDigits: 2,
  }).format(num);
}

// ADDED 2026-09-08 — de-duplication pass: an audit of the whole codebase
// found ~15 files independently hand-rolling their own
// `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
// (or a close variant), each as a local, unexported function named
// `money`/`formatCurrency`/`formatINR`/`fmt` — same formatting, three
// slightly different behaviors for a missing amount depending which copy
// you happened to be reading. These three cover every behavior actually
// found in use, so every one of those local copies can redirect to
// whichever of these already matches what it did — see each duplicate
// site's own comment for which one and why, rather than guessing a single
// one-size-fits-all replacement.

/**
 * Always shows a real amount — missing/NaN default to 0, never null/'—'.
 * Use for a running total that must always show a number (a cart total, a
 * price breakdown line) even when it's genuinely zero.
 * @param {number|string|null|undefined} amount
 * @returns {string}
 */
export function formatAmount(amount) {
  const num = Number(amount ?? 0);
  return `₹${(isNaN(num) ? 0 : num).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/**
 * Missing amount → the placeholder string '—' (for inline text/labels
 * where returning null would render as literally nothing, reading as a
 * layout gap rather than "no value").
 * @param {number|string|null|undefined} amount
 * @returns {string}
 */
export function formatAmountOrDash(amount) {
  if (amount == null) return '—';
  return formatAmount(amount);
}

/**
 * Missing amount → null (for a value handed to a row/list component that
 * itself hides when given a falsy value — returning '—' here would make
 * every such row always render instead of only the ones with real data).
 * @param {number|string|null|undefined} amount
 * @returns {string|null}
 */
export function formatAmountOrNull(amount) {
  if (amount == null) return null;
  return formatAmount(amount);
}
