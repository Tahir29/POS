'use client';

// Promo code entry + applied discount display — for the cart, wherever it's
// shown. Was CheckoutDiscountSection, checkout-only (2026-08-24); renamed
// and made self-contained (2026-08-26) so a customer can apply a code
// without reaching checkout first. Currently used on the mini cart drawer
// and the full cart page — deliberately NOT the product detail page
// (removed same day per product decision: applying a promo there was
// confusing before an item is even in the cart to price against). It's the
// SAME cart-wide `appliedPromos` state everywhere it IS shown (a promo was
// never product-scoped), so applying it on one screen and seeing it
// reflected on another is exactly the same state, not a sync problem to
// solve.
//
// Pricing is fetched HERE, not passed down from the page — useCheckoutPricing
// takes no arguments (reads the cart/store straight from Redux), so every
// screen that renders this component shares ONE query, keyed on cart
// contents + applied promo codes (see that hook). Applying a promo in the
// mini cart and then opening the full cart page reads the exact same cached
// result — no separate fetch, no chance of the two disagreeing.
//
// Multiple promos can be applied at once — each gets its own badge with an
// independent remove action. The add-more input/picker stays visible even
// once promos are applied. "Similar" (same discount-type) conflicts are
// blocked with a toast in usePromoValidation, not here.

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { useCart } from '@/hooks/cart/useCart';
import { useCheckoutPricing } from '@/hooks/checkout/useCheckoutPricing';
import { usePromoValidation } from '@/hooks/checkout/usePromoValidation';
import { removePromo as removePromoAction } from '@/store/slices/cartSlice';
import PromoCodeInput from '@/components/features/checkout/PromoCodeInput';
import PromoCodeSheet from '@/components/features/checkout/PromoCodeSheet';
import AppliedPromoTag from '@/components/shared/AppliedPromoTag';
import TOAST from '@/constants/toastMessages';

export default function DiscountSection() {
  const dispatch = useDispatch();
  const { appliedPromos, removePromo, isEmpty } = useCart();
  const {
    lineItems: pricedLineItems,
    documentId,
    promotionDetails,
    isLoading: isPricing,
  } = useCheckoutPricing();
  const { validatePromo, isValidating } = usePromoValidation(pricedLineItems, documentId);
  // Nothing to check eligibility against yet — same gate usePromoValidation
  // itself falls back on (PROMO_NOT_READY), surfaced here too so the input
  // is disabled rather than accepting a click it can only reject. Two
  // distinct reasons, two distinct hints — an empty cart isn't "still
  // pricing," and saying so on the product page (where the cart is often
  // genuinely empty) would just be wrong.
  const notReadyToCheck = !pricedLineItems?.length;
  const disabledHint = isEmpty
    ? 'Add items to your cart before applying a promo code.'
    : 'Still pricing your cart — promo codes can be applied once that’s done.';

  const amountFor = (promoCode) =>
    promotionDetails.find((row) => row.promotion_code === promoCode)?.promotion_amount ?? null;

  // Defensive backstop, not the primary gate (usePromoValidation checks
  // eligibility BEFORE applying, so this shouldn't normally have anything to
  // catch) — a promo genuinely eligible at apply-time can still stop
  // applying if the CART changes afterward (an item added or removed), since
  // nothing else revalidates an already-applied promo. Auto-removes it the
  // moment live pricing confirms that, rather than leaving a stale "applied"
  // tag for something no longer true. Only fires once pricing has genuinely
  // settled (!isPricing) — otherwise a promo would get yanked mid-fetch,
  // before promotionDetails has had a chance to include its row. Dispatches
  // the RAW action, not useCart's wrapped removePromo — that one always
  // toasts a generic "Promo code removed.", which would double up with the
  // more specific message below for a removal the operator didn't ask for.
  useEffect(() => {
    if (isPricing) return;
    appliedPromos.forEach((promo) => {
      if (amountFor(promo.promoCode) == null) {
        dispatch(removePromoAction(promo.promoCode));
        toast.error(TOAST.CART.PROMO_NO_LONGER_APPLIES(promo.promoCode));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPricing, promotionDetails]);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-bold text-foreground">Discount</h2>

      {/* "You saved ₹X" is the server's own promotion_amount, so the badge
          cannot advertise one saving while the summary deducts another.
          Muted styling (hasEffect=false) below is a defensive fallback for
          the one render between pricing settling and the effect above
          actually removing the promo — in practice imperceptible, but it
          means even that brief instant never LOOKS like a win either. */}
      {appliedPromos.map((promo) => {
        const amount = amountFor(promo.promoCode);
        const declined = !isPricing && amount == null;
        return (
          <div key={promo.promoCode} className="flex flex-col gap-1">
            <AppliedPromoTag
              promoCode={promo.promoCode}
              discountAmount={amount ?? 0}
              hasEffect={!declined}
              onRemove={() => removePromo(promo.promoCode)}
            />
          </div>
        );
      })}

      <PromoCodeInput
        onApply={validatePromo}
        isValidating={isValidating}
        disabled={notReadyToCheck}
        disabledHint={disabledHint}
      />
      <PromoCodeSheet onApply={validatePromo} isApplying={isValidating} appliedPromos={appliedPromos} />
    </section>
  );
}
