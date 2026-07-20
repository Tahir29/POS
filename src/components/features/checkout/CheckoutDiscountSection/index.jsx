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
import PromoCodeInput from '@/components/features/checkout/PromoCodeInput';
import PromoCodeSheet from '@/components/features/checkout/PromoCodeSheet';
import PromoAppliedBadge from '@/components/features/checkout/PromoAppliedBadge';

export default function CheckoutDiscountSection() {
  const { appliedPromos, removePromo } = useCart();
  const { validatePromo, isValidating } = usePromoValidation();

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-bold text-stone-800">Discount</h2>

      {appliedPromos.map((promo) => (
        <PromoAppliedBadge
          key={promo.promoCode}
          promoCode={promo.promoCode}
          discountAmount={promo.discountAmount}
          onRemove={() => removePromo(promo.promoCode)}
        />
      ))}

      <PromoCodeInput onApply={validatePromo} isValidating={isValidating} />
      <PromoCodeSheet onApply={validatePromo} isApplying={isValidating} appliedPromos={appliedPromos} />
    </section>
  );
}