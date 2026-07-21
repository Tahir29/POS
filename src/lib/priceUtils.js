// src/lib/priceUtils.js

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
    maximumFractionDigits: 0,
  }).format(num);
}
