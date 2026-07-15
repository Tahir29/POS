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

import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { listPromotions } from '@/services/promotionService';
import { useCart } from '@/hooks/cart/useCart';
import { useCartTotals } from '@/hooks/cart/useCartTotals';
import { isPromotionActive, computePromotionDiscount } from '@/lib/normalizers/promotion';
import TOAST from '@/constants/toastMessages';

export function usePromoValidation() {
  const { applyPromo } = useCart();
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
