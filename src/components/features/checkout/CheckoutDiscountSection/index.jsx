'use client';

// Checkout section for promo code entry and applied discount display.
//
// Multiple promos can be applied at once — each gets its own badge with an
// independent remove action. The add-more input/picker stays visible even
// once promos are applied. "Similar" (same discount-type) conflicts are
// blocked with a toast in usePromoValidation, not here.

import { useCart } from '@/hooks/cart/useCart';
import { usePromoValidation } from '@/hooks/checkout/usePromoValidation';
import PromoCodeInput from '@/components/features/checkout/PromoCodeInput';
import PromoCodeSheet from '@/components/features/checkout/PromoCodeSheet';
import AppliedPromoTag from '@/components/shared/AppliedPromoTag';

/**
 * @param {{ promotionDetails?: object[], isPricing?: boolean }} props
 *   promotionDetails — the `invoice_promotions[]` rows Helper/ApplyPromotions
 *   returned for this basket (see useCheckoutPricing). Each carries the
 *   promotion's real `promotion_amount`; a promo with no row is one the
 *   server declined to apply to these items.
 */
export default function CheckoutDiscountSection({ promotionDetails = [], isPricing = false }) {
  const { appliedPromos, removePromo } = useCart();
  const { validatePromo, isValidating } = usePromoValidation();

  const amountFor = (promoCode) =>
    promotionDetails.find((row) => row.promotion_code === promoCode)?.promotion_amount ?? null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-bold text-foreground">Discount</h2>

      {/* "You saved ₹X" is the server's own promotion_amount, so the badge
          cannot advertise one saving while the summary deducts another. */}
      {appliedPromos.map((promo) => {
        const amount = amountFor(promo.promoCode);
        return (
          <div key={promo.promoCode} className="flex flex-col gap-1">
            <AppliedPromoTag
              promoCode={promo.promoCode}
              discountAmount={amount ?? 0}
              onRemove={() => removePromo(promo.promoCode)}
            />
            {/* A promotion can be perfectly valid and still not apply to
                what's in the basket — most here are scoped to the diamond or
                making-charge component. Saying so beats a silent ₹0. */}
            {!isPricing && amount == null && (
              <p className="px-1 text-xs text-muted-foreground">
                Doesn&apos;t apply to these items — no discount given.
              </p>
            )}
          </div>
        );
      })}

      <PromoCodeInput onApply={validatePromo} isValidating={isValidating} />
      <PromoCodeSheet onApply={validatePromo} isApplying={isValidating} appliedPromos={appliedPromos} />
    </section>
  );
}