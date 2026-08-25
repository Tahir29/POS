'use client';

// Checkout section for promo code entry and applied discount display.
//
// Multiple promos can be applied at once — each gets its own badge with an
// independent remove action. The add-more input/picker stays visible even
// once promos are applied. "Similar" (same discount-type) conflicts are
// blocked with a toast in usePromoValidation, not here.

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { useCart } from '@/hooks/cart/useCart';
import { usePromoValidation } from '@/hooks/checkout/usePromoValidation';
import { removePromo as removePromoAction } from '@/store/slices/cartSlice';
import PromoCodeInput from '@/components/features/checkout/PromoCodeInput';
import PromoCodeSheet from '@/components/features/checkout/PromoCodeSheet';
import AppliedPromoTag from '@/components/shared/AppliedPromoTag';
import TOAST from '@/constants/toastMessages';

/**
 * @param {{
 *   promotionDetails?: object[],
 *   isPricing?: boolean,
 *   pricedLineItems?: object[]|null,
 *   documentId?: number|null,
 * }} props
 *   promotionDetails — the `invoice_promotions[]` rows Helper/ApplyPromotions
 *   returned for this basket (see useCheckoutPricing). Each carries the
 *   promotion's real `promotion_amount`; a promo with no row is one the
 *   server declined to apply to these items.
 *   pricedLineItems/documentId — this basket's own priced lines, passed
 *   through to usePromoValidation so a candidate code can be checked for
 *   real eligibility BEFORE it's ever applied (2026-08-24), not after.
 */
export default function CheckoutDiscountSection({
  promotionDetails = [], isPricing = false, pricedLineItems = null, documentId = null,
}) {
  const dispatch = useDispatch();
  const { appliedPromos, removePromo } = useCart();
  const { validatePromo, isValidating } = usePromoValidation(pricedLineItems, documentId);
  // Nothing to check eligibility against yet — same gate usePromoValidation
  // itself falls back on (PROMO_NOT_READY), surfaced here too so the input
  // is disabled rather than accepting a click it can only reject.
  const notReadyToCheck = !pricedLineItems?.length;

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
        disabledHint="Still pricing your cart — promo codes can be applied once that's done."
      />
      <PromoCodeSheet onApply={validatePromo} isApplying={isValidating} appliedPromos={appliedPromos} />
    </section>
  );
}