'use client';

// src/components/features/cart/AppliedPromoTag/index.jsx
// Shows the applied promo code with a remove option.
// Promo validation against OrnaVerse happens in Phase 9 (Checkout) /
// Phase 15 (Promotions) — this component only renders state.

import { Tag, X } from 'lucide-react';

/**
 * @param {{
 *   promoCode: string | null,
 *   onRemove: () => void,
 * }} props
 */
export default function AppliedPromoTag({ promoCode, onRemove }) {
  if (!promoCode) return null;

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <Tag size={16} className="text-emerald-600 shrink-0" aria-hidden="true" />
        <p className="text-sm font-semibold text-emerald-700 truncate">
          {promoCode} applied
        </p>
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