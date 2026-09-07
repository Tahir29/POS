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
