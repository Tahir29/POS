// src/lib/normalizers/promotion.js
// Shared helpers for OrnaVerse CRM.PromotionRow — used by both the
// promo-code picker (checkout) and validation of a manually-typed code.
//
// GetPromotion does NOT filter by code (confirmed 2026-07-15 — it returns
// the same fixed record regardless of input), so every consumer works off
// the full Promotion/List result and filters/matches client-side instead.

/**
 * True when a promotion is currently usable: approved, not disabled, and
 * today falls within its from_date/to_date range.
 * @param {object} promotion — PromotionRow
 * @returns {boolean}
 */
export function isPromotionActive(promotion) {
  if (!promotion?.is_approved || promotion?.is_disabled) return false;

  const now  = Date.now();
  const from = promotion.from_date ? new Date(promotion.from_date).getTime() : -Infinity;
  const to   = promotion.to_date   ? new Date(promotion.to_date).getTime()   : Infinity;

  return now >= from && now <= to;
}

/**
 * Computes the discount amount in rupees for a promotion against a cart
 * subtotal. Percentage takes priority when set; otherwise falls back to a
 * flat discount_amount. Confirmed real field names 2026-07-15 — the older
 * discount_type/discount_value/min_order_value guesses in this codebase
 * never matched the actual API response.
 * @param {object} promotion — PromotionRow
 * @param {number} subtotal
 * @returns {number}
 */
export function computePromotionDiscount(promotion, subtotal) {
  const pct = Number(promotion?.discount_percentage) || 0;
  const amt = Number(promotion?.discount_amount) || 0;
  const raw = pct > 0 ? (subtotal * pct) / 100 : amt;
  const clamped = Math.min(Math.max(0, raw), subtotal);
  // Round to paisa — a percentage-of-subtotal multiplication routinely
  // produces more than 2 decimal places, which is never valid for currency.
  return Math.round(clamped * 100) / 100;
}

/**
 * Short human-readable summary of what a promotion gives — "20% off" or
 * "₹500 off" — for display in the promo picker.
 * @param {object} promotion — PromotionRow
 * @returns {string|null}
 */
export function describePromotionDiscount(promotion) {
  const pct = Number(promotion?.discount_percentage) || 0;
  const amt = Number(promotion?.discount_amount) || 0;
  if (pct > 0) return `${pct}% off`;
  if (amt > 0) return `₹${amt.toLocaleString('en-IN')} off`;
  return null;
}
