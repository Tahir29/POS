'use client';

// Side sheet listing every currently-active promo code — tapping one
// applies it immediately, same as typing it into PromoCodeInput.
//
// REDESIGNED 2026-09-08 — matches a reference "bank offer" card design: a
// vertical tab label on the left edge, a bold discount headline + scope
// subtitle, then a full-width action button. (A category/gem icon badge
// top-right was part of the first pass at this but removed same day —
// product decision, no icon.)
// Kept as APPLY, not copy-to-clipboard (product decision) — this is a POS
// screen an operator applies an offer FROM, not a storefront checkout box
// they'd paste a copied code into, so tapping still calls onApply directly
// exactly as the previous ticket design did; only the layout changed.
// (Previous "torn ticket stub" design — perforated seam, discount value in
// the stub — replaced outright, not kept as an alternate.)

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

// Scope subtitle — "On Diamond Value" etc. `discount_calc_on` selects which
// COMPONENT of the item a promotion's percentage applies to (confirmed live
// against OrnaVerse 2026-08-05, see checkoutPricingService.js/
// useCheckoutPricing.js's own header for the full story): 1 = whole value,
// 3 = diamond, 6 = making charges. This is real data, not a guess at what
// the reference design's "On Diamond Products" line should say for OUR
// promotions — falls back to the promotion's own name for any value not in
// this known set, rather than showing nothing.
const DISCOUNT_SCOPE_LABEL = {
  1: 'On Total Value',
  3: 'On Diamond Value',
  6: 'On Making Charges',
};

// ENTIRE-CARD BUTTON (2026-09-08) — used to be a static card with a
// separate "Apply Offer" button nested inside it; now the whole card IS
// the button (tap anywhere to apply), and the pill that used to be a real
// nested <button> is now a plain styled <div> — a real button can't
// contain another interactive button (invalid HTML, and two overlapping
// tap targets doing the same thing besides). Once applied, that pill
// simplifies to plain "Applied" text (no border/box) and the WHOLE card
// gets a light green tint, so an applied offer reads at a glance without
// hunting for a small badge — nothing left to tap, so nothing left that
// needs to look tappable.
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
      {/* Vertical tab label — reference's "BANK OFFER" strip. Kept generic
          ("OFFER") since OrnaVerse's PromotionRow carries no bank/type
          categorization to show something more specific here. */}

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

        {/* flex-1 min-h-0 (2026-09-08 fix) — SheetContent is a plain
            flex-col column with a fixed h-full, and this is the one child
            meant to scroll internally. Without min-h-0, a flex item's
            default min-height is its own content size ("auto"), so this
            div never actually shrank to the space left under SheetHeader —
            it just kept growing with the list and squeezed every
            OfferTicket card down to fit inside the sheet's fixed height
            instead of the list scrolling past it. flex-1 lets it claim the
            remaining height; min-h-0 is what actually lets it shrink to
            that instead of to its content. */}
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
