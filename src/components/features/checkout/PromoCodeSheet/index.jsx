'use client';

// src/components/features/checkout/PromoCodeSheet/index.jsx
// Side sheet listing every currently-active promo code — tapping one
// applies it immediately, same as typing it into PromoCodeInput.

import { useState } from 'react';
import { Loader2, Tag, ChevronRight, Check } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useActivePromotions } from '@/hooks/checkout/useActivePromotions';
import { describePromotionDiscount } from '@/lib/normalizers/promotion';

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
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

        <div className="flex flex-col gap-2 overflow-y-auto px-4 pb-4">
          {isLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              Loading offers…
            </div>
          )}

          {!isLoading && promotions.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No offers are running right now.
            </p>
          )}

          {!isLoading && promotions.map((promo) => {
            const discountLabel = describePromotionDiscount(promo);
            const isApplied = appliedCodes.has(promo.promotion_code);
            return (
              <button
                key={promo.promotion_id}
                type="button"
                disabled={isApplying || isApplied}
                onClick={() => handleSelect(promo.promotion_code)}
                className="
                  flex items-center justify-between gap-3 rounded-lg border border-border
                  px-3 py-2.5 text-left transition-colors
                  hover:border-primary/40 hover:bg-primary/5
                  disabled:cursor-not-allowed disabled:opacity-50
                "
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Tag size={16} className="shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {promo.promotion_name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono font-semibold text-muted-foreground">
                        {promo.promotion_code}
                      </span>
                      {discountLabel && <span>{discountLabel}</span>}
                      {(promo.from_date || promo.to_date) && (
                        <span>
                          · till {formatDate(promo.to_date)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {isApplied ? (
                  <span className="flex items-center gap-1 shrink-0 text-xs font-medium text-status-in-stock">
                    <Check size={14} aria-hidden="true" />
                    Applied
                  </span>
                ) : (
                  <ChevronRight size={16} className="shrink-0 text-muted-foreground/50" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
