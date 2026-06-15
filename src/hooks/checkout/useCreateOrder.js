// src/hooks/checkout/useCreateOrder.js
// Order submission mutation — Phase 9b (Checkout).
// Maps to: POST Services/MarketPlace/Order/Generate
// Source of truth: API_MAPPING.md Section 11.3, DEVELOPMENT_PHASES.md Phase 9b
//
// ⚠️ BLOCKED: APP_CONFIG.ORDER.POS_CHANNEL_ID is currently null. OrnaVerse's
// `channel` field is required for order creation and must be confirmed
// with the integration team. This hook throws before calling the API if
// the channel is not configured, and surfaces a clear toast so the
// associate isn't stuck on a silent failure.

import { useMutation } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { createOrder } from '@/services/orderService';
import { useCart } from '@/hooks/cart/useCart';
import { useCartTotals } from '@/hooks/cart/useCartTotals';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import APP_CONFIG from '@/constants/appConfig';
import TOAST from '@/constants/toastMessages';

/**
 * Splits a single display name into first/last for OrnaVerse's
 * order.customer.first_name / last_name fields.
 */
function splitName(fullName) {
  if (!fullName) return { firstName: 'Guest', lastName: '' };
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? 'Guest',
    lastName: parts.slice(1).join(' ') || '',
  };
}

/**
 * Generates a client-side order id/number. OrnaVerse requires order_id
 * and order_no to be supplied by the POS (per API_MAPPING.md). Uses a
 * timestamp-based value to avoid collisions on a single device.
 */
function generateOrderNumber() {
  return Date.now();
}

export function useCreateOrder() {
  const { items, appliedPromoCode, appliedPromoDetails, clearCart } = useCart();
  const { subtotal, discount, total } = useCartTotals();
  const { customerId, customerName, customerMobile } = useCustomerSession();
  const activeStoreId = useSelector(selectActiveStoreId);

  const mutation = useMutation({
    mutationFn: (paymentModes) => {
      const channel = APP_CONFIG.ORDER.POS_CHANNEL_ID;

      if (channel === null || channel === undefined) {
        // Blocked pending OrnaVerse confirmation — see file header.
        throw new Error('POS_CHANNEL_ID_NOT_CONFIGURED');
      }

      const { firstName, lastName } = splitName(customerName);
      const orderNo = generateOrderNumber();

      const payload = {
        channel,
        order: {
          order_id: orderNo,
          order_no: orderNo,
          status: APP_CONFIG.ORDER.DEFAULT_STATUS,
          store_id: activeStoreId,
          customer: {
            id: customerId,
            first_name: firstName,
            last_name: lastName,
            phone: customerMobile,
          },
          items: items.map((item, index) => ({
            line_item_id: index + 1,
            sku: item.sku,
            title: item.itemName,
            quantity: item.quantity,
            unit_price: item.unitPrice,
          })),
          subtotal,
          discount_amount: discount,
          total_amount: total,
          promo_code: appliedPromoCode ?? undefined,
          promo_details: appliedPromoDetails ?? undefined,
          payments: paymentModes.map((p) => ({
            mode_id: p.modeId,
            mode_name: p.modeName,
            amount: p.amount,
          })),
        },
      };

      return createOrder(payload);
    },
    onSuccess: (data) => {
      const orderNo = data?.Entity?.order_no ?? data?.Entity?.order_id ?? '';
      toast.success(TOAST.ORDERS.CREATED(orderNo));
      clearCart();
    },
    onError: (error) => {
      if (error?.message === 'POS_CHANNEL_ID_NOT_CONFIGURED') {
        toast.error(
          'Checkout is not yet configured for this store (POS channel ID missing). Contact support.'
        );
        return;
      }
      toast.error(TOAST.ORDERS.CREATE_FAILED);
    },
  });

  return {
    placeOrder: mutation.mutate,
    isPlacingOrder: mutation.isPending,
    orderResult: mutation.data,
    error: mutation.error,
  };
}