'use client';

// src/components/features/checkout/PromoCodeSheet/index.jsx
// Side sheet listing every currently-active promo code — tapping one
// applies it immediately, same as typing it into PromoCodeInput.
//
// Redesigned 2026-07-28: each offer now reads as an actual ticket/coupon
// (perforated seam + notch cutouts between a stub and the details) instead
// of a plain bordered row — a well-worn convention for "this is redeemable"
// that fits a promo list better than a generic list-item card. The stub
// leads with the discount value in large type (the one number a staff
// member actually scans for), everything else follows.

import { useState } from 'react';
import { Percent, ChevronRight, Check, Ticket } from 'lucide-react';
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

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// Split for the stub's large display — describePromotionDiscount's "20% off"
// / "₹500 off" strings read fine inline but need the number isolated from
// "off" to actually size up on the stub.
function getDiscountValue(promo) {
  const pct = Number(promo?.discount_percentage) || 0;
  const amt = Number(promo?.discount_amount) || 0;
  if (pct > 0) return `${pct}%`;
  if (amt > 0) return `₹${amt.toLocaleString('en-IN')}`;
  return null;
}

// ── Offer Ticket ──────────────────────────────────────────────────────────────

function OfferTicket({ promo, isApplied, isApplying, onSelect }) {
  const discountValue = getDiscountValue(promo);
  const expiryLabel = promo.to_date ? `Valid till ${formatDate(promo.to_date)}` : null;

  return (
    <button
      type="button"
      disabled={isApplying || isApplied}
      onClick={() => onSelect(promo.promotion_code)}
      className="
        group relative flex w-full items-stretch overflow-hidden rounded-2xl border border-border
        bg-card text-left shadow-sm transition-all duration-standard ease-premium
        hover:-translate-y-0.5 hover:shadow-md hover:border-accent/40
        disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm
      "
    >
      {/* Stub — discount headline, accent-tinted like a torn ticket half */}
      <div className="relative flex w-24 shrink-0 flex-col items-center justify-center gap-1 bg-accent/10 px-2 py-4">
        {discountValue ? (
          <>
            <span className="font-heading text-xl leading-none text-accent tabular-nums">
              {discountValue}
            </span>
            <span className="text-[10px] font-semibold tracking-wider text-accent/80">OFF</span>
          </>
        ) : (
          <Ticket size={22} className="text-accent" aria-hidden="true" />
        )}

        {/* Perforation notches — cut into the seam, matching the sheet's own
            background so they read as actual punched holes, not decoration */}
        <span className="absolute -top-2 right-0 h-4 w-4 -translate-x-1/2 rounded-full bg-popover" aria-hidden="true" />
        <span className="absolute -bottom-2 right-0 h-4 w-4 -translate-x-1/2 rounded-full bg-popover" aria-hidden="true" />
      </div>

      {/* Perforated seam */}
      <div className="relative w-px shrink-0 border-l border-dashed border-border" aria-hidden="true" />

      {/* Details */}
      <div className="flex flex-1 items-center justify-between gap-3 px-3.5 py-3 min-w-0">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {promo.promotion_name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wide text-foreground/80">
              {promo.promotion_code}
            </span>
            {expiryLabel && (
              <span className="text-xs text-muted-foreground">{expiryLabel}</span>
            )}
          </div>
        </div>

        {isApplied ? (
          <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-status-in-stock">
            <Check size={14} aria-hidden="true" />
            Applied
          </span>
        ) : (
          <ChevronRight
            size={16}
            className="shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        )}
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

        <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-4">
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
