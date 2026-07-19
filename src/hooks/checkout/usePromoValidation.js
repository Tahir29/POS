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

import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { listPromotions } from '@/services/promotionService';
import { useCart } from '@/hooks/cart/useCart';
import { useCartTotals } from '@/hooks/cart/useCartTotals';
import {
  isPromotionActive,
  computePromotionDiscount,
  getPromotionDiscountType,
} from '@/lib/normalizers/promotion';
import tracker from '@/lib/analytics/tracker';
import EVENTS from '@/lib/analytics/events';
import TOAST from '@/constants/toastMessages';

export function usePromoValidation() {
  const { applyPromo, appliedPromos } = useCart();
  const { subtotal } = useCartTotals();

  const mutation = useMutation({
    mutationFn: async (promoCode) => {
      const response = await listPromotions();
      const entities = response?.data?.Entities ?? [];
      const active   = entities.filter(isPromotionActive);
      return active.find(
        (p) => p.promotion_code?.toUpperCase() === promoCode.toUpperCase()
      ) ?? null;
    },

    onSuccess: (promotion, promoCode) => {
      if (!promotion) {
        toast.error(TOAST.CART.PROMO_INVALID(promoCode));
        return;
      }

      const minOrder = Number(promotion.minimum_sales_amount) || 0;
      if (minOrder > 0 && subtotal < minOrder) {
        toast.error(TOAST.CART.PROMO_INVALID(promoCode));
        return;
      }

      const incomingType = getPromotionDiscountType(promotion);
      const hasSimilar = appliedPromos.some(
        (p) => getPromotionDiscountType(p.promoDetails) === incomingType
      );
      if (hasSimilar) {
        toast.error(TOAST.CART.PROMO_SIMILAR_APPLIED);
        tracker.track(EVENTS.PROMO_SIMILAR_BLOCKED, {
          promoCode: promotion.promotion_code,
          discountType: incomingType,
        });
        return;
      }

      applyPromo({
        promoCode:     promotion.promotion_code,
        promoDetails:  promotion,
        discountAmount: computePromotionDiscount(promotion, subtotal),
      });
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
