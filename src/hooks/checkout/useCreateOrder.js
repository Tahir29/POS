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
import { buildPricedLineItems, summarizeLineItems } from '@/services/checkoutPricingService';
import { useCart } from '@/hooks/cart/useCart';
import { useCartTotals } from '@/hooks/cart/useCartTotals';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';
import { useExchangeRate } from '@/hooks/checkout/useExchangeRate';
import { useOrderHeaderConfig } from '@/hooks/checkout/useOrderHeaderConfig';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';
import TOAST from '@/constants/toastMessages';

/**
 * Builds the OrderRow Entity payload from cart state.
 * All field names confirmed against OrnaVerse.POS.InvoiceItemsRow schema.
 *
 * employee_id/sales_person_id + exchange_rate — see useCreateInvoice.js
 * header for the full rationale (same schema, same findings 2026-07-16).
 *
 * HEADER FIELDS (financial_year_id, ledger_id, is_tax_applicable,
 * auto_posting, is_document_number_editable, round_off, backdating flags,
 * document_id/document_no) + LINE ITEMS (full SetSalesItems computed shape,
 * not a hand-rolled summary) — see useCreateInvoice.js's header comment for
 * the full root-cause story (confirmed live 2026-07-28); same fix applied
 * here for parity.
 */
function buildOrderEntity({
  lineItems, discount,
  customerId, customerName, customerMobile,
  activeStoreId, paymentModes,
  salesPersonId, exchangeRate, headerConfig,
}) {
  const today = new Date().toISOString();
  const { subTotal, taxableAmount, taxAmount, netAmount, pieces, weight, netWeight } =
    summarizeLineItems(lineItems);

  const discountedNet = +Math.max(0, netAmount - (discount ?? 0)).toFixed(2);
  const roundedNet = Math.round(discountedNet);
  const round_off  = +(roundedNet - discountedNet).toFixed(2);

  const receipt_details = paymentModes.map((p) => ({
    mode_id:   p.modeId,
    mode_code: p.modeCode ?? '',
    mode_name: p.modeName,
    amount:    p.amount,
  }));
  const receiptAmount = +receipt_details.reduce((s, r) => s + (r.amount ?? 0), 0).toFixed(2);

  return {
    party_id:      customerId,
    party_name:    customerName ?? undefined,
    mobile:        customerMobile ?? undefined,
    user_id:       null,
    company_id:    activeStoreId,
    document_date: today,
    currency_id:   APP_CONFIG.CURRENCY.INR_ID,
    exchange_rate: exchangeRate,
    employee_id:      salesPersonId,
    sales_person_id:  salesPersonId,
    pieces, weight, net_weight: netWeight,
    sub_total:      subTotal,
    discount:       discount ?? 0,
    taxable_amount: taxableAmount,
    tax_amount:     taxAmount,
    net_amount:     roundedNet,
    base_sub_total: subTotal,
    base_net_amount: roundedNet,
    base_tax_amount: taxAmount,
    round_off,
    receipt_amount: receiptAmount,
    balance_amount: +(roundedNet - receiptAmount).toFixed(2),
    document_id:                 APP_CONFIG.DOCUMENT_TYPES.POS_ORDER,
    document_no:                 headerConfig.documentNo,
    financial_year_id:           headerConfig.financialYearId,
    ledger_id:                   headerConfig.ledgerId,
    is_tax_applicable:           headerConfig.isTaxApplicable,
    auto_posting:                headerConfig.autoPosting,
    is_document_number_editable: headerConfig.isDocumentNumberEditable,
    allow_backdated_entry:       false,
    number_of_backdated_days:    0,
    is_einvoice:                 false,
    line_items: lineItems,
    receipt_details,
    promotion_details: [],
  };
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  const { items, clearCart } = useCart();
  const { discount } = useCartTotals();
  const { customerId, customerName, customerMobile } = useCustomerSession();
  const activeStoreId = useSelector(selectActiveStoreId);
  const { exchangeRate } = useExchangeRate();
  const headerConfig = useOrderHeaderConfig(APP_CONFIG.DOCUMENT_TYPES.POS_ORDER);

  const mutation = useMutation({
    /**
     * @param {{ paymentModes: {modeId, modeCode, modeName, amount}[], salesPersonId: number }} params
     */
    mutationFn: async ({ paymentModes, salesPersonId }) => {
      if (!headerConfig.isReady) {
        throw new Error('Store configuration is still loading — please try again in a moment');
      }

      const lineItems = await buildPricedLineItems({ items, activeStoreId, salesPersonId });

      const entity = buildOrderEntity({
        lineItems, discount,
        customerId, customerName, customerMobile,
        activeStoreId, paymentModes,
        salesPersonId, exchangeRate, headerConfig,
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