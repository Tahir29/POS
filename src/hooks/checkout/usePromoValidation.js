// src/hooks/checkout/usePromoValidation.js
// Promo code validation mutation — Phase 9b (Checkout).
// On success, normalizes the OrnaVerse promotion record and dispatches
// cart/applyPromo via useCart. On failure (not found / inactive / error),
// shows a user-friendly toast and does not touch cart state.
//
// NOTE: Exact response shape for GetPromotion has not yet been confirmed
// against a real OrnaVerse response (per handoff prompt). This hook reads
// the fields documented in API_MAPPING.md (discount_type, discount_value,
// min_order_value, valid_from/valid_to) and treats "NA" / missing values
// as empty, consistent with the rest of the data layer. Revisit once a
// real Postman response is shared.

import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { getPromotion } from '@/services/promotionService';
import { useCart } from '@/hooks/cart/useCart';
import { useCartTotals } from '@/hooks/cart/useCartTotals';
import TOAST from '@/constants/toastMessages';

const PERCENTAGE_TYPES = ['percentage', 'percent', '%'];

function isEmptyValue(value) {
  return value === null || value === undefined || value === 'NA' || value === '';
}

/**
 * Computes the discount amount in rupees given a promotion record and
 * the current cart subtotal.
 */
function computeDiscountAmount(promotion, subtotal) {
  const discountType = !isEmptyValue(promotion.discount_type)
    ? String(promotion.discount_type).toLowerCase()
    : null;
  const discountValue = !isEmptyValue(promotion.discount_value)
    ? Number(promotion.discount_value)
    : 0;

  if (!discountValue || discountValue <= 0) return 0;

  let amount;
  if (discountType && PERCENTAGE_TYPES.includes(discountType)) {
    amount = (subtotal * discountValue) / 100;
  } else {
    amount = discountValue;
  }

  return Math.min(Math.max(0, amount), subtotal);
}

/**
 * Normalizes an OrnaVerse promotion record, treating "NA" as empty.
 */
function normalizePromotion(entity) {
  const get = (key) => (!isEmptyValue(entity?.[key]) ? entity[key] : null);

  return {
    promoCode:      get('promo_code'),
    discountType:   get('discount_type'),
    discountValue:  get('discount_value'),
    minOrderValue:  get('min_order_value'),
    validFrom:      get('valid_from'),
    validTo:        get('valid_to'),
    applicableItems: entity?.applicable_items ?? null,
    raw:            entity,
  };
}

export function usePromoValidation() {
  const { applyPromo } = useCart();
  const { subtotal } = useCartTotals();

  const mutation = useMutation({
    mutationFn: (promoCode) => getPromotion(promoCode),
    onSuccess: (response, promoCode) => {
      // OrnaVerse wraps single records in response.data.Entity
      const entity = response?.data?.Entity ?? null;

      if (!entity) {
        toast.error(TOAST.CART.PROMO_INVALID(promoCode));
        return;
      }

      const promotion = normalizePromotion(entity);

      // Minimum order value check (client-side preview — server enforces
      // actual eligibility at order creation per API_MAPPING.md notes)
      if (promotion.minOrderValue && subtotal < Number(promotion.minOrderValue)) {
        toast.error(TOAST.CART.PROMO_INVALID(promoCode));
        return;
      }

      const discountAmount = computeDiscountAmount(promotion, subtotal);

      applyPromo({
        promoCode: promotion.promoCode ?? promoCode,
        promoDetails: promotion,
        discountAmount,
      });
    },
    onError: () => {
      toast.error(TOAST.CART.PROMO_FAILED);
    },
  });

  return {
    validatePromo: mutation.mutate,
    isValidating: mutation.isPending,
  };
}