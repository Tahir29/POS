'use client';

// src/components/features/checkout/CheckoutDiscountSection/index.jsx
// Checkout section for promo code entry and applied discount display.
//
// Multiple promos can be applied at once — each gets its own badge with an
// independent remove action. The add-more input/picker stays visible even
// once promos are applied. "Similar" (same discount-type) conflicts are
// blocked with a toast in usePromoValidation, not here.

import { useCart } from '@/hooks/cart/useCart';
import { usePromoValidation } from '@/hooks/checkout/usePromoValidation';
import { computePromotionDiscount } from '@/lib/normalizers/promotion';
import PromoCodeInput from '@/components/features/checkout/PromoCodeInput';
import PromoCodeSheet from '@/components/features/checkout/PromoCodeSheet';
import AppliedPromoTag from '@/components/shared/AppliedPromoTag';

/**
 * @param {{ realSubtotal?: number }} props
 *   realSubtotal — the server-priced (stock-piece) subtotal from
 *   useCheckoutPricing. When provided, each promo's displayed "you saved ₹X"
 *   is recomputed against it rather than promo.discountAmount (which is
 *   computed against the cart's catalog-estimated subtotal) — otherwise this
 *   figure disagrees with the discount actually subtracted from the invoice
 *   (see useCheckoutPricing.js).
 */
export default function CheckoutDiscountSection({ realSubtotal } = {}) {
  const { appliedPromos, removePromo } = useCart();
  const { validatePromo, isValidating } = usePromoValidation();

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-bold text-foreground">Discount</h2>

      {appliedPromos.map((promo) => {
        const displayAmount = realSubtotal != null
          ? computePromotionDiscount(promo.promoDetails, realSubtotal)
          : promo.discountAmount;
        return (
          <AppliedPromoTag
            key={promo.promoCode}
            promoCode={promo.promoCode}
            discountAmount={displayAmount}
            onRemove={() => removePromo(promo.promoCode)}
          />
        );
      })}

      <PromoCodeInput onApply={validatePromo} isValidating={isValidating} />
      <PromoCodeSheet onApply={validatePromo} isApplying={isValidating} appliedPromos={appliedPromos} />
    </section>
  );
}