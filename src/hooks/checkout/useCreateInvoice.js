// src/hooks/checkout/useCreateInvoice.js
// PRIMARY checkout hook — POS/Invoice/Create → POS/Invoice/Post.
// Use this for all direct-billing sales at the POS counter.
// Use useCreateOrder for deposit/reserve-and-collect scenarios.
//
// FLOW:
//   1. buildInvoiceEntity() — assembles InvoiceRow from cart + session state
//   2. createInvoice(entity) → SaveResponse { EntityId: transaction_id }
//   3. postInvoice(transactionId) → finalises stock, accounting, receipts
//   4. On success: clear cart, invalidate caches, show confirmation
//
// PAYLOAD — InvoiceRow confirmed fields (v1.json):
//   party_id, company_id, document_date, currency_id
//   sub_total, discount, net_amount, tax_amount
//   line_items[]   → InvoiceItemsRow (item_id, sku, pieces, item_rate, net_amount, ...)
//   receipt_details[] → InvoiceReceiptRow (mode_id, mode_code, mode_name, amount)
//
// STATUS is DERIVED after posting (balance_amount + receipt_amount) — never sent.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { createInvoice, postInvoice } from '@/services/orderService';
import { useCart } from '@/hooks/cart/useCart';
import { useCartTotals } from '@/hooks/cart/useCartTotals';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';
import TOAST from '@/constants/toastMessages';

/**
 * Builds InvoiceRow Entity from cart + session state.
 * Field names confirmed against OrnaVerse.POS.InvoiceRow +
 * OrnaVerse.POS.InvoiceItemsRow + OrnaVerse.POS.InvoiceReceiptRow (v1.json).
 *
 * @param {{
 *   items:          CartItem[],
 *   subtotal:       number,
 *   discount:       number,
 *   total:          number,
 *   customerId:     number,
 *   activeStoreId:  number,
 *   paymentModes:   { modeId, modeCode, modeName, amount }[],
 *   narration?:     string,
 * }} params
 */
function buildInvoiceEntity({
  items, subtotal, discount, total,
  customerId, activeStoreId,
  paymentModes, narration,
}) {
  const today = new Date().toISOString();

  const line_items = items.map((item, idx) => ({
    item_line_no: idx + 1,
    item_id:      item.itemId,
    sku:          item.sku,
    item_code:    item.itemCode,
    item_name:    item.itemName,
    pieces:       item.quantity,
    // item_rate = unit price on line item (confirmed InvoiceItemsRow field)
    item_rate:    item.unitPrice,
    sub_total:    +(item.unitPrice * item.quantity).toFixed(2),
    net_amount:   +(item.unitPrice * item.quantity).toFixed(2),
    // TEMP DIAGNOSTIC — style_id / item_size_id / narration commented out
    // to isolate whether one of these three is causing the server-side
    // exception on Invoice/Create. Restore once confirmed innocent (or
    // fix whichever one is the actual cause).
    // style_id:     item.styleId    ?? undefined,
    // item_size_id: item.sizeId     ?? undefined,
    // narration:    item.attributes ? JSON.stringify(item.attributes) : undefined,
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
    // Confirmed InvoiceRow field (see file header) — was previously omitted
    // entirely. No client-side GST calculation exists yet (decided to skip
    // that breakdown for now), so sending 0 rather than leaving the field
    // out, in case the server's Create logic does arithmetic against it
    // without null-guarding.
    tax_amount:    0,
    narration:     narration ?? undefined,
    line_items,
    receipt_details,
  };
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { items, clearCart } = useCart();
  const { subtotal, discount, total } = useCartTotals();
  const { customerId } = useCustomerSession();
  const activeStoreId = useSelector(selectActiveStoreId);

  const mutation = useMutation({
    /**
     * @param {{
     *   paymentModes: { modeId, modeCode, modeName, amount }[],
     *   narration?:   string,
     * }} params
     */
    mutationFn: async ({ paymentModes, narration }) => {
      const entity = buildInvoiceEntity({
        items, subtotal, discount, total,
        customerId, activeStoreId,
        paymentModes, narration,
      });

      // Step 1: Create draft invoice
      const createResponse = await createInvoice(entity);
      const transactionId  = createResponse?.EntityId;

      if (!transactionId) {
        throw new Error('Invoice creation failed — no EntityId returned');
      }

      // Step 2: Post (finalise) — triggers stock deduction + accounting
      const postResponse = await postInvoice(transactionId);

      return { transactionId, createResponse, postResponse };
    },

    onSuccess: ({ transactionId }) => {
      toast.success(TOAST.INVOICES.CREATED(transactionId));
      clearCart();
      // Invalidate invoice + order list caches5
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },

    onError: (error) => {
      console.error('[useCreateInvoice]', error);
      // If create succeeded but post failed, the draft sits on the server.
      // The user can re-attempt posting from the invoices list.
      if (error?.message?.includes('post')) {
        toast.error(TOAST.INVOICES.POST_FAILED);
      } else {
        toast.error(TOAST.INVOICES.CREATE_FAILED);
      }
    },
  });

  return {
    placeInvoice:    mutation.mutateAsync,
    isPlacingInvoice:mutation.isPending,
    invoiceResult:   mutation.data,
    error:           mutation.error,
    reset:           mutation.reset,
  };
}