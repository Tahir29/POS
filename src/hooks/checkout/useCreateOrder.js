// src/hooks/checkout/useCreateOrder.js
// POS Order creation — native POS/Order/Create → POS/Order/Post flow.
// Replaces the old MarketPlace/Order/Generate approach entirely.
// POS_CHANNEL_ID blocker is gone — no channel field required.
//
// TWO FLOWS, and the checkout screen now offers BOTH as an explicit choice:
//
//   ORDER FLOW  (deposit/reserve — collect later):  ← this hook
//     createOrder(entity) → SaveResponse { EntityId }
//     postOrder(EntityId) → finalises stock deduction
//
//   INVOICE FLOW (immediate sale):
//     See useCreateInvoice.js
//
// WHY THIS HOOK HAD NO CALLERS, AND WHY THAT MATTERED
//
// When checkout moved to direct billing, this hook was left wired to nothing
// — so POS/Order/Create stopped being called by the app at all, and the
// Orders screen (which lists POS/Order/List, document type 53) stopped
// receiving anything. It still showed the last order raised before the
// switch, which read exactly like sales silently failing to save. They
// hadn't: they were being filed as invoices, under Invoices.
//
// The two documents are not interchangeable and raising both for one sale
// would double-count it, so checkout picks one per sale:
//   • Invoice (54) — cash-and-carry. Must be paid in full; OrnaVerse rejects
//     a short-paid one outright.
//   • Order (53) — a booking the customer leaves an ADVANCE against. Partial
//     payment is the point, and the remainder rides as balance_amount.
//     Confirmed: doc 53 does not check stock, unlike 54.
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
import {
  buildPricedLineItems,
  applyPromotionsToLines,
  summarizeLineItems,
} from '@/services/checkoutPricingService';
import { localDocumentDate, buildReceiptDetails } from '@/lib/checkout/documentFields';
import { useCart } from '@/hooks/cart/useCart';
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
 * HEADER FIELDS + LINE ITEMS + PROMOTIONS + RECEIPT DETAILS — see
 * useCreateInvoice.js's header comment for the full root-cause story. This
 * document type is the one that was actually captured, on 2026-08-05:
 * POS/Order/Create → EntityId 259, HO-RPO-08-26-00001, and every field below
 * was diffed against that payload.
 */
function buildOrderEntity({
  lineItems, promotionDetails,
  customerId, customerName, customerMobile,
  activeStoreId, paymentModes, narration,
  salesPersonId, exchangeRate, headerConfig,
}) {
  const today = localDocumentDate();
  const {
    subTotal, discount, taxableAmount, taxAmount, netAmount,
    pieces, weight, netWeight,
  } = summarizeLineItems(lineItems);

  // Summed straight from the lines, which ApplyPromotions already discounted
  // and re-taxed. Reference capture: sub_total 104699.04, discount 12177.6,
  // taxable_amount 92521.44, tax_amount 2775.64, net_amount 95297.
  const roundedNet = Math.round(netAmount);
  const round_off  = +(roundedNet - netAmount).toFixed(2);

  const receipt_details = buildReceiptDetails({
    paymentModes, customerId, activeStoreId, exchangeRate, headerConfig,
  });
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
    // Positive on an order taken with an advance — that is the balance the
    // customer settles on collection, not an error.
    balance_amount: +(roundedNet - receiptAmount).toFixed(2),
    narration:     narration ?? undefined,
    document_id:                 APP_CONFIG.DOCUMENT_TYPES.POS_ORDER,
    financial_year_id:           headerConfig.financialYearId,
    ledger_id:                   headerConfig.ledgerId,
    is_tax_applicable:           headerConfig.isTaxApplicable,
    auto_posting:                headerConfig.autoPosting,
    is_document_number_editable: headerConfig.isDocumentNumberEditable,
    allow_backdated_entry:       false,
    number_of_backdated_days:    headerConfig.numberOfBackdatedDays ?? 0,
    is_einvoice:                 false,
    line_items: lineItems,
    receipt_details,
    // The invoice_promotions[] rows from Helper/ApplyPromotions, passed
    // through untouched — see useCreateInvoice.js.
    promotion_details: promotionDetails ?? [],
  };
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  const { items, appliedPromos } = useCart();
  const { customerId, customerName, customerMobile } = useCustomerSession();
  const activeStoreId = useSelector(selectActiveStoreId);
  const { exchangeRate } = useExchangeRate();
  const headerConfig = useOrderHeaderConfig(APP_CONFIG.DOCUMENT_TYPES.POS_ORDER);

  const mutation = useMutation({
    /**
     * @param {{
     *   paymentModes:  {modeId, modeCode, modeName, amount, ledgerId?, raw?}[],
     *   salesPersonId: number,
     *   pricedLineItems?:  object[],  // post-promotion lines from useCheckoutPricing
     *   promotionDetails?: object[],  // its invoice_promotions rows
     *   narration?:    string,
     * }} params
     */
    mutationFn: async ({
      paymentModes, salesPersonId, pricedLineItems,
      promotionDetails: promotionDetailsArg, narration,
    }) => {
      if (!headerConfig.isReady) {
        throw new Error('Store configuration is still loading — please try again in a moment');
      }

      const documentId = APP_CONFIG.DOCUMENT_TYPES.POS_ORDER;

      // Reuse the lines the checkout screen already priced and quoted from,
      // exactly as the invoice flow does — re-pricing here would risk booking
      // a different figure than the one the customer was just quoted, and
      // repeat the slowest calls in the flow.
      let lineItems;
      let promotionDetails;

      if (pricedLineItems) {
        lineItems = pricedLineItems.map((row) => ({ ...row, sales_person_id: salesPersonId }));
        promotionDetails = promotionDetailsArg ?? [];
      } else {
        const priced = await buildPricedLineItems({
          items, activeStoreId, salesPersonId, documentId,
        });
        const promoted = await applyPromotionsToLines({
          lineItems: priced, appliedPromos, documentId, exchangeRate,
        });
        lineItems = promoted.lineItems;
        promotionDetails = promoted.promotionDetails;
      }

      const entity = buildOrderEntity({
        lineItems, promotionDetails,
        customerId, customerName, customerMobile,
        activeStoreId, paymentModes, narration,
        salesPersonId, exchangeRate, headerConfig,
      });

      // Step 1: Create draft order. `stage` is stamped on the error so the
      // handler can tell create from post without sniffing the message —
      // see useCreateInvoice.js for why that sniffing never worked.
      let createResponse;
      try {
        createResponse = await createOrder(entity);
      } catch (err) {
        err.stage = 'create';
        throw err;
      }
      const transactionId = createResponse?.EntityId;

      if (!transactionId) {
        const err = new Error('Order creation failed — no EntityId returned');
        err.stage = 'create';
        throw err;
      }

      // Step 2: Post (finalise) — skipped when the document type auto-posts.
      // See useCreateInvoice.js for the full note: with auto_posting:true,
      // Create already posts and a follow-up Post returns
      // {"Code":"AlreadyPosted"}, which would surface as a failed order.
      let postResponse = null;
      if (!headerConfig.autoPosting) {
        try {
          postResponse = await postOrder(transactionId);
        } catch (err) {
          err.stage = 'post';
          err.transactionId = transactionId;
          throw err;
        }
      }
      return {
        transactionId, createResponse, postResponse,
        netAmount:     entity.net_amount,
        balanceAmount: entity.balance_amount,
      };
    },

    onSuccess: ({ transactionId }) => {
      toast.success(TOAST.ORDERS.CREATED(transactionId));
      // NOT clearing the cart here — same reason as useCreateInvoice: clearing
      // drops the attached customer a render before `orderResult` is set, and
      // the checkout screen's own guards bounce the operator to /cart before
      // they ever see the order number. The screen clears it once the
      // confirmation is on screen.
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },

    onError: (error) => {
      console.error('[useCreateOrder]', error);

      // Show OrnaVerse's own reason when it sent one — see useCreateInvoice.js.
      const reason = error?.serverMessage ?? error?.message ?? null;
      const fallback = error?.stage === 'post'
        ? TOAST.ORDERS.POST_FAILED
        : TOAST.ORDERS.CREATE_FAILED;

      toast.error(reason ?? fallback);
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