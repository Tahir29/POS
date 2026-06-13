'use client';

// src/components/features/checkout/PromoAppliedBadge/index.jsx
// Shows the applied discount details (code + amount) with a remove action.

import { Tag, X } from 'lucide-react';

/**
 * @param {{
 *   promoCode: string,
 *   discountAmount: number,
 *   onRemove: () => void,
 * }} props
 */
export default function PromoAppliedBadge({ promoCode, discountAmount, onRemove }) {
  if (!promoCode) return null;

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <Tag size={16} className="text-emerald-600 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-700 truncate">
            {promoCode} applied
          </p>
          {discountAmount > 0 && (
            <p className="text-xs text-emerald-600">
              You saved ₹{discountAmount.toLocaleString('en-IN')}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove promo code ${promoCode}`}
        className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-stone-400 hover:text-destructive hover:bg-destructive/10 transition-colors"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}