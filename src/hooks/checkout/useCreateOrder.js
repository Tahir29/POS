// src/hooks/checkout/useCreateOrder.js
// POS Order creation — native POS/Order/Create → POS/Order/Post flow.
// Replaces the old MarketPlace/Order/Generate approach entirely.
// POS_CHANNEL_ID blocker is gone — no channel field required.
//
// TWO FLOWS (both available, defaulting to Invoice):
//
//   ORDER FLOW  (deposit/reserve — collect later):
//     createOrder(entity) → SaveResponse { EntityId }
//     postOrder(EntityId) → finalises stock deduction
//
//   INVOICE FLOW (immediate sale — use useCreateInvoice instead):
//     See useCreateInvoice.js
//
// This hook handles the ORDER flow.
// Use useCreateInvoice for the primary checkout (direct billing).
//
// PAYLOAD — OrderRow key fields (confirmed v1.json):
//   party_id       — customer (required)
//   company_id     — active store (required)
//   document_date  — sale date ISO string (required)
//   currency_id    — 103 = INR
//   line_items[]   — InvoiceItemsRow subset (item_id, sku, pieces, item_rate, net_amount)
//   receipt_details[] — InvoiceReceiptRow subset (mode_id, mode_code, mode_name, amount)

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { createOrder, postOrder } from '@/services/orderService';
import { useCart } from '@/hooks/cart/useCart';
import { useCartTotals } from '@/hooks/cart/useCartTotals';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';
import TOAST from '@/constants/toastMessages';

/**
 * Builds the OrderRow Entity payload from cart state.
 * All field names confirmed against OrnaVerse.POS.InvoiceItemsRow schema.
 */
function buildOrderEntity({ items, subtotal, discount, total, customerId, activeStoreId, paymentModes }) {
  const today = new Date().toISOString();

  const line_items = items.map((item, idx) => ({
    item_line_no: idx + 1,
    item_id:      item.itemId,
    sku:          item.sku,
    item_code:    item.itemCode,
    item_name:    item.itemName,
    pieces:       item.quantity,
    item_rate:    item.unitPrice,   // line item price field = item_rate (NOT price)
    sub_total:    item.unitPrice * item.quantity,
    net_amount:   item.unitPrice * item.quantity,
    style_id:     item.styleId    ?? undefined,
    item_size_id: item.sizeId     ?? undefined,
  }));

  const receipt_details = paymentModes.map((p) => ({
    mode_id:   p.modeId,
    mode_code: p.modeCode ?? '',
    mode_name: p.modeName,
    amount:    p.amount,
  }));

  return {
    party_id:      customerId,
    company_id:    activeStoreId,
    document_date: today,
    currency_id:   APP_CONFIG.CURRENCY.INR_ID,
    sub_total:     subtotal,
    discount:      discount ?? 0,
    net_amount:    total,
    line_items,
    receipt_details,
  };
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  const { items, clearCart } = useCart();
  const { subtotal, discount, total } = useCartTotals();
  const { customerId } = useCustomerSession();
  const activeStoreId = useSelector(selectActiveStoreId);

  const mutation = useMutation({
    /**
     * @param {{ modeId, modeCode, modeName, amount }[]} paymentModes
     */
    mutationFn: async (paymentModes) => {
      const entity = buildOrderEntity({
        items, subtotal, discount, total,
        customerId, activeStoreId, paymentModes,
      });

      // Step 1: Create draft order
      const createResponse = await createOrder(entity);
      const transactionId  = createResponse?.EntityId;

      if (!transactionId) {
        throw new Error('Order creation failed — no EntityId returned');
      }

      // Step 2: Post (finalise) the order
      const postResponse = await postOrder(transactionId);
      return { transactionId, createResponse, postResponse };
    },

    onSuccess: ({ transactionId }) => {
      toast.success(TOAST.ORDERS.CREATED(transactionId));
      clearCart();
      // Invalidate order list so it reflects the new order
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },

    onError: (error) => {
      console.error('[useCreateOrder]', error);
      toast.error(TOAST.ORDERS.CREATE_FAILED);
    },
  });

  return {
    placeOrder:    mutation.mutateAsync,
    isPlacingOrder:mutation.isPending,
    orderResult:   mutation.data,
    error:         mutation.error,
    reset:         mutation.reset,
  };
}