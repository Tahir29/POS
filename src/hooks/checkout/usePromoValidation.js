// src/hooks/checkout/usePromoValidation.js
// Promo code validation for checkout. GetPromotion does not filter by code
// server-side, so a typed code is validated by fetching every promotion and
// matching promotion_code client-side (same as useActivePromotions).
//
// Multiple promos can be applied at once, but two of the same discount
// mechanism (both %-off or both flat-off) cannot stack — grouped by discount
// type, not exact code/name.
//
// Eligibility is checked before applying: the candidate code is run through
// the same server call checkout pricing uses (Helper/ApplyPromotions) against
// the already-priced basket, and only reaches cart/applyPromo if that comes
// back with a real discount row — avoids adding an ineligible promo and then
// having to walk it back once pricing catches up.
//
// A promo and a Lucira Coins redemption (cartSlice's redeemedCoins) are
// mutually exclusive; checked first, before fetching promotions. The reverse
// guard (blocking coins while a promo is applied) lives in useCart.js's
// handleApplyLoyaltyCoins instead, since it needs no server call.

import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { listPromotions } from '@/services/promotionService';
import { applyPromotionsToLines } from '@/services/checkoutPricingService';
import { useCart } from '@/hooks/cart/useCart';
import { useSessionTrackingContext } from '@/hooks/analytics/useSessionTrackingContext';
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
  const { applyPromo, appliedPromos, redeemedCoins } = useCart();
  const sessionCtx = useSessionTrackingContext();

  const mutation = useMutation({
    mutationFn: async (promoCode) => {
      // Mutual exclusivity with Lucira Coins — checked before fetching
      // promotions at all, regardless of whether the code itself is valid.
      if (redeemedCoins > 0) return { status: 'coins_active' };

      const response = await listPromotions();
      const entities = response?.data?.Entities ?? [];
      const active   = entities.filter(isPromotionActive);
      const promotion = active.find(
        (p) => p.promotion_code?.toUpperCase() === promoCode.toUpperCase()
      ) ?? null;

      if (!promotion) return { status: 'invalid' };

      // No local minimum-order gate — `minimum_sales_amount` is measured
      // against a component chosen by `minimum_sales_amount_calc_on`, so
      // eligibility is entirely the server call below.
      const incomingType = getPromotionDiscountType(promotion);
      const hasSimilar = appliedPromos.some(
        (p) => getPromotionDiscountType(p.promoDetails) === incomingType
      );
      if (hasSimilar) return { status: 'similar', promotion };

      if (!pricedLineItems?.length) return { status: 'not_ready', promotion };

      // Checked in isolation against the base priced lines, not folded on
      // top of whatever else is already applied — catches the common case
      // (a promo that just doesn't apply to what's in the basket) without
      // modeling every multi-promo stacking interaction.
      const { promotionDetails } = await applyPromotionsToLines({
        lineItems:     pricedLineItems,
        appliedPromos: [{ promoCode: promotion.promotion_code, promoDetails: promotion }],
        documentId,
      });

      if (!promotionDetails.length) return { status: 'ineligible', promotion };
      return { status: 'eligible', promotion };
    },

    // Every outcome tracks an analytics event, with a `reason` distinguishing
    // which one so PROMO_FAILED isn't an undifferentiated bucket.
    onSuccess: (result, promoCode) => {
      switch (result.status) {
        case 'coins_active':
          toast.error(TOAST.CART.PROMO_BLOCKED_BY_COINS);
          tracker.track(EVENTS.PROMO_FAILED, { reason: 'coins_active', promoCode, ...sessionCtx });
          return;

        case 'invalid':
          toast.error(TOAST.CART.PROMO_INVALID(promoCode));
          tracker.track(EVENTS.PROMO_FAILED, { reason: 'invalid', promoCode, ...sessionCtx });
          return;

        case 'similar':
          toast.error(TOAST.CART.PROMO_SIMILAR_APPLIED);
          tracker.track(EVENTS.PROMO_SIMILAR_BLOCKED, {
            promoCode:    result.promotion.promotion_code,
            discountType: getPromotionDiscountType(result.promotion),
            ...sessionCtx,
          });
          return;

        case 'not_ready':
          toast.error(TOAST.CART.PROMO_NOT_READY);
          tracker.track(EVENTS.PROMO_FAILED, {
            reason: 'not_ready', promoCode, promotionCode: result.promotion?.promotion_code, ...sessionCtx,
          });
          return;

        case 'ineligible':
          toast.error(TOAST.CART.PROMO_NOT_APPLICABLE(result.promotion.promotion_code));
          tracker.track(EVENTS.PROMO_FAILED, {
            reason: 'ineligible', promoCode: result.promotion.promotion_code, ...sessionCtx,
          });
          return;

        case 'eligible':
          // `promoDetails` is the full PromotionRow, which is what
          // Helper/ApplyPromotions needs as input; the rupee value comes
          // back from checkout's own pricing pass (cartSlice.recalculateTotals).
          //
          // Not tracked here directly — dispatching cart/applyPromo below is
          // already caught by analyticsMiddleware.js's 'cart/applyPromo' case,
          // which fires EVENTS.PROMO_APPLIED once per dispatch. A second
          // tracker.track() call here would double-fire the event.
          applyPromo({
            promoCode:    result.promotion.promotion_code,
            promoDetails: result.promotion,
          });
          return;

        default:
          return;
      }
    },

    onError: (error, promoCode) => {
      toast.error(TOAST.CART.PROMO_FAILED);
      tracker.track(EVENTS.PROMO_FAILED, {
        reason: 'error', promoCode, error: error?.message ?? 'unknown', ...sessionCtx,
      });
    },
  });

  return {
    validatePromo: mutation.mutate,
    isValidating:  mutation.isPending,
  };
}
