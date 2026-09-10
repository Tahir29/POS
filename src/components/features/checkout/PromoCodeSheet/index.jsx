'use client';

// Side sheet listing every currently-active promo code — tapping one
// applies it immediately, same as typing it into PromoCodeInput. Bank-
// offer-card style: vertical tab label, discount headline + scope
// subtitle, whole card as the tap target (not copy-to-clipboard — this is
// a POS screen an operator applies an offer from, not a code to paste
// elsewhere).

import { useState } from 'react';
import { Percent, Check, Tag } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/shared/EmptyState';
import InlineLoader from '@/components/shared/InlineLoader';
import { useActivePromotions } from '@/hooks/checkout/useActivePromotions';
import { cn } from '@/lib/utils';
import { formatDateCompact as formatDate } from '@/lib/dateUtils';

// Headline number — "5%" / "₹500" — the discount's own value, isolated
// from "off" so it can be composed into "Additional 5% Off" below.
function getDiscountValue(promo) {
  const pct = Number(promo?.discount_percentage) || 0;
  const amt = Number(promo?.discount_amount) || 0;
  if (pct > 0) return `${pct}%`;
  if (amt > 0) return `₹${amt.toLocaleString('en-IN')}`;
  return null;
}

// Scope subtitle — discount_calc_on selects which component of the item a
// promotion's percentage applies to: 1 = whole value, 3 = diamond, 6 =
// making charges (see useCheckoutPricing.js). Falls back to the
// promotion's own name for any other value.
const DISCOUNT_SCOPE_LABEL = {
  1: 'On Total Value',
  3: 'On Diamond Value',
  6: 'On Making Charges',
};

// The whole card is the button (not a nested button inside a button,
// which is invalid HTML). Once applied, the card gets a light green tint
// so it reads at a glance as no longer tappable.
function OfferTicket({ promo, isApplied, isApplying, onSelect }) {
  const discountValue = getDiscountValue(promo);
  const scopeLabel = DISCOUNT_SCOPE_LABEL[promo?.discount_calc_on] ?? promo.promotion_name;
  const expiryLabel = promo.to_date ? `Valid till ${formatDate(promo.to_date)}` : null;

  return (
    <button
      type="button"
      disabled={isApplying || isApplied}
      onClick={() => onSelect(promo.promotion_code)}
      className={cn(
        'relative flex w-full rounded-2xl border text-left shadow-sm transition-colors',
        isApplied
          ? 'border-status-in-stock/30 bg-status-in-stock/10'
          : 'border-border bg-card hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60',
      )}
    >
      {isApplied ? (
        <div className="flex w-8 shrink-0 items-center justify-center bg-status-in-stock py-4">
          <span
            className="text-[10px] font-bold tracking-widest text-primary-foreground whitespace-nowrap [writing-mode:vertical-rl] rotate-180"
          >
            APPLIED
          </span>
        </div>
      ) : (
        <div className="flex w-8 shrink-0 items-center justify-center bg-primary py-4">
          <span
            className="text-[10px] font-bold tracking-widest text-primary-foreground whitespace-nowrap [writing-mode:vertical-rl] rotate-180"
          >
            APPLY
          </span>
        </div>
      )}
      

      <div className="flex flex-1 flex-col gap-3 p-4 min-w-0">
        <div className="min-w-0">
          <p className="text-base font-bold text-foreground">
            {discountValue ? `Additional ${discountValue} Off` : promo.promotion_name}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">{scopeLabel}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wide text-foreground/80">
              {promo.promotion_code}
            </span>
            {expiryLabel && (
              <span className="text-xs text-muted-foreground">{expiryLabel}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

/**
 * @param {{
 *   onApply: (code: string) => void,
 *   isApplying?: boolean,
 *   appliedPromos?: { promoCode: string }[],
 * }} props
 */
export default function PromoCodeSheet({ onApply, isApplying, appliedPromos = [] }) {
  const [open, setOpen] = useState(false);
  const { data: promotions = [], isLoading } = useActivePromotions();
  const appliedCodes = new Set(appliedPromos.map((p) => p.promoCode));

  const handleSelect = (code) => {
    onApply(code);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="link"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-auto self-start px-0 text-xs"
      >
        View available offers
      </Button>

      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Available Offers</SheetTitle>
          <SheetDescription>
            Tap an offer to apply it to this order.
          </SheetDescription>
        </SheetHeader>

        {/* min-h-0 is required: without it this flex child's default
            min-height (its own content size) stops it from shrinking to
            the space left under SheetHeader, so the list grows instead of
            scrolling internally. */}
        <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto px-4 pb-4">
          {isLoading && <InlineLoader label="Loading offers…" />}

          {!isLoading && promotions.length === 0 && (
            <EmptyState
              icon={Percent}
              title="No offers are running right now"
              description="Check back later for new promotions on this order."
            />
          )}

          {!isLoading && promotions.map((promo) => (
            <OfferTicket
              key={promo.promotion_id}
              promo={promo}
              isApplied={appliedCodes.has(promo.promotion_code)}
              isApplying={isApplying}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
