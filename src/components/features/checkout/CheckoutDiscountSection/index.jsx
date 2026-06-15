'use client';

// src/components/features/checkout/CheckoutDiscountSection/index.jsx
// Checkout section for promo code entry and applied discount display.

import { useCart } from '@/hooks/cart/useCart';
import { useCartTotals } from '@/hooks/cart/useCartTotals';
import { usePromoValidation } from '@/hooks/checkout/usePromoValidation';
import PromoCodeInput from '@/components/features/checkout/PromoCodeInput';
import PromoAppliedBadge from '@/components/features/checkout/PromoAppliedBadge';

export default function CheckoutDiscountSection() {
  const { appliedPromoCode, removePromo } = useCart();
  const { discount } = useCartTotals();
  const { validatePromo, isValidating } = usePromoValidation();

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="text-sm font-bold text-stone-800">Discount</h2>

      {appliedPromoCode ? (
        <PromoAppliedBadge
          promoCode={appliedPromoCode}
          discountAmount={discount}
          onRemove={removePromo}
        />
      ) : (
        <PromoCodeInput onApply={validatePromo} isValidating={isValidating} />
      )}
    </section>
  );
}