// src/hooks/checkout/usePromoValidation.js
// Promo code validation — Phase 9b (Checkout).
//
// GetPromotion does NOT filter by code (confirmed 2026-07-15 — it returns
// the same fixed record no matter what code is sent), so a typed code is
// validated by fetching every promotion and matching promotion_code
// client-side, same as the promo picker (useActivePromotions). On match:
// checks the minimum order value, computes the discount using the real
// field names (discount_percentage / discount_amount / minimum_sales_amount
// — the previous discount_type/discount_value/min_order_value guesses never
// matched the actual API response), and dispatches cart/applyPromo.
//
// MULTI-PROMO: more than one promo can be applied at once, but two
// "similar" ones (same discount mechanism — both %-off or both flat-₹-off)
// cannot stack. Confirmed with the user 2026-07-19: group by discount type,
// not by exact code/name — one % promo + one flat promo can coexist, but a
// second promo of a type already applied is blocked with a toast.
//
// ELIGIBILITY CHECKED BEFORE APPLYING (2026-08-24). This used to add ANY
// active code straight to the cart and let checkout's own live pricing
// discover — a few seconds later — whether it actually gave anything,
// showing "applied successfully" only to contradict itself right after.
// Per product decision, an ineligible promo must never be added at all: the
// SAME server call checkout pricing makes (Helper/ApplyPromotions, via
// checkoutPricingService's applyPromotionsToLines) now runs here first, in
// isolation for just the candidate code against the already-priced basket,
// and the promo only reaches cart/applyPromo if that comes back with a real
// discount row. One decisive toast either way, not apply-then-un-apply.

import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { listPromotions } from '@/services/promotionService';
import { applyPromotionsToLines } from '@/services/checkoutPricingService';
import { useCart } from '@/hooks/cart/useCart';
import {
  isPromotionActive,
  getPromotionDiscountType,
} from '@/lib/normalizers/promotion';
import tracker from '@/lib/analytics/tracker';
import EVENTS from '@/lib/analytics/events';
import TOAST from '@/constants/toastMessages';

/**
 * @param {object[]|null} pricedLineItems — this basket's own already-priced
 *   lines (useCheckoutPricing's output), needed to check a candidate promo
 *   for real rather than guessing. null/empty while checkout is still
 *   pricing — Apply is a no-op (PROMO_NOT_READY) until it's ready.
 * @param {number|null} documentId — which document type these lines were
 *   priced as (order vs invoice) — Helper/ApplyPromotions needs it too.
 */
export function usePromoValidation(pricedLineItems, documentId) {
  const { applyPromo, appliedPromos } = useCart();

  const mutation = useMutation({
    mutationFn: async (promoCode) => {
      const response = await listPromotions();
      const entities = response?.data?.Entities ?? [];
      const active   = entities.filter(isPromotionActive);
      const promotion = active.find(
        (p) => p.promotion_code?.toUpperCase() === promoCode.toUpperCase()
      ) ?? null;

      if (!promotion) return { status: 'invalid' };

      // NO local minimum-order gate. `minimum_sales_amount` is paired with
      // `minimum_sales_amount_calc_on`, which selects which value it is
      // measured against — the same component scoping that makes the
      // discount itself unknowable client-side. Eligibility is entirely the
      // server's call below.
      const incomingType = getPromotionDiscountType(promotion);
      const hasSimilar = appliedPromos.some(
        (p) => getPromotionDiscountType(p.promoDetails) === incomingType
      );
      if (hasSimilar) return { status: 'similar', promotion };

      if (!pricedLineItems?.length) return { status: 'not_ready', promotion };

      // Checked in isolation — just this one candidate against the base
      // priced lines, not folded on top of whatever else is already
      // applied. Good enough to catch the common case (a promo that's
      // simply never going to apply to what's in the basket, like a
      // bullion-excluded code on a gold coin) without trying to model every
      // multi-promo stacking interaction here too.
      const { promotionDetails } = await applyPromotionsToLines({
        lineItems:     pricedLineItems,
        appliedPromos: [{ promoCode: promotion.promotion_code, promoDetails: promotion }],
        documentId,
      });

      if (!promotionDetails.length) return { status: 'ineligible', promotion };
      return { status: 'eligible', promotion };
    },

    onSuccess: (result, promoCode) => {
      switch (result.status) {
        case 'invalid':
          toast.error(TOAST.CART.PROMO_INVALID(promoCode));
          return;

        case 'similar':
          toast.error(TOAST.CART.PROMO_SIMILAR_APPLIED);
          tracker.track(EVENTS.PROMO_SIMILAR_BLOCKED, {
            promoCode:    result.promotion.promotion_code,
            discountType: getPromotionDiscountType(result.promotion),
          });
          return;

        case 'not_ready':
          toast.error(TOAST.CART.PROMO_NOT_READY);
          return;

        case 'ineligible':
          toast.error(TOAST.CART.PROMO_NOT_APPLICABLE(result.promotion.promotion_code));
          return;

        case 'eligible':
          // No amount is attached here either — `promoDetails` is the full
          // PromotionRow, which is what Helper/ApplyPromotions needs as
          // input; the rupee value comes back from checkout's own pricing
          // pass. See cartSlice.recalculateTotals.
          applyPromo({
            promoCode:    result.promotion.promotion_code,
            promoDetails: result.promotion,
          });
          return;

        default:
          return;
      }
    },

    onError: () => {
      toast.error(TOAST.CART.PROMO_FAILED);
    },
  });

  return {
    validatePromo: mutation.mutate,
    isValidating:  mutation.isPending,
  };
}
