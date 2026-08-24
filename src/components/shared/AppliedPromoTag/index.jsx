'use client';

// Applied-promo-code pill with a remove action, shown on both the
// cart (drawer + standalone page) and checkout screens. Was two
// near-identical components (cart's AppliedPromoTag, checkout's
// PromoAppliedBadge) differing only in an optional "You saved ₹X"
// line — merged here with discountAmount as an optional prop.

import { Tag, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * @param {{
 *   promoCode: string | null,
 *   discountAmount?: number,
 *   onRemove: () => void,
 *   className?: string,
 * }} props
 */
export default function AppliedPromoTag({ promoCode, discountAmount, onRemove, className }) {
  if (!promoCode) return null;

  return (
    <div className={cn('flex items-center justify-between gap-2 rounded-lg bg-status-in-stock/10 px-3 py-2.5', className)}>
      <div className="flex items-center gap-2 min-w-0">
        <Tag size={16} className="text-status-in-stock shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-status-in-stock truncate">
            {promoCode} applied
          </p>
          {discountAmount > 0 && (
            <p className="text-xs text-status-in-stock">
              You saved ₹{discountAmount.toLocaleString('en-IN')}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove promo code ${promoCode}`}
        className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
