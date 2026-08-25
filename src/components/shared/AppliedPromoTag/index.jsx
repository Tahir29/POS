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
 *   hasEffect?: boolean,
 *   onRemove: () => void,
 *   className?: string,
 * }} props
 *   hasEffect (2026-08-24, default true) — the code was applied, but on
 *   checkout it can still turn out to give NOTHING for what's in the basket
 *   (most promos here are scoped to the diamond/making-charge component —
 *   see checkoutPricingService.js and CheckoutDiscountSection's own "no
 *   discount given" caption right under this tag). This always rendered the
 *   same green "success" styling regardless, so a promo that gave ₹0 still
 *   LOOKED like it worked, directly contradicting the caption underneath it.
 *   Pass hasEffect={false} for that case to switch to a neutral/muted look
 *   instead — still shown as applied (removable), just not celebrated as a
 *   win. The cart page/drawer never know the outcome yet (no live pricing
 *   there), so they never pass this and keep the original styling.
 */
export default function AppliedPromoTag({ promoCode, discountAmount, hasEffect = true, onRemove, className }) {
  if (!promoCode) return null;

  const tone = hasEffect
    ? { bg: 'bg-status-in-stock/10', text: 'text-status-in-stock' }
    : { bg: 'bg-muted', text: 'text-muted-foreground' };

  return (
    <div className={cn('flex items-center justify-between gap-2 rounded-lg px-3 py-2.5', tone.bg, className)}>
      <div className="flex items-center gap-2 min-w-0">
        <Tag size={16} className={cn(tone.text, 'shrink-0')} aria-hidden="true" />
        <div className="min-w-0">
          <p className={cn('text-sm font-semibold truncate', tone.text)}>
            {promoCode} applied
          </p>
          {discountAmount > 0 && (
            <p className={cn('text-xs', tone.text)}>
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
