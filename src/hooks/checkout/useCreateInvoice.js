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
//   party_id, company_id, document_date, currency_id, exchange_rate
//   sub_total, discount, net_amount, tax_amount
//   line_items[]   → InvoiceItemsRow (item_id, sku, pieces, item_rate, net_amount, ...)
//   receipt_details[] → InvoiceReceiptRow (mode_id, mode_code, mode_name, amount)
//
// tax — cartSlice now computes a flat 3% GST (the real statutory rate for
// gold/silver/diamond jewellery in India, not an approximation) on the
// taxable value (subtotal - discount), single source of truth shared with
// CartSummary/CheckoutPaymentSection/PlaceOrderButton via useCartTotals. Sent
// below as tax_amount alongside net_amount (which is tax-inclusive, i.e. the
// actual amount collected from the customer).
//
// employee_id / sales_person_id — confirmed 2026-07-16 the vendor's own POS
// Sale screen requires selecting an employee before placing the order.
// Exact field name InvoiceRow expects isn't confirmed (only SchemeEnrollmentRow
// is confirmed to use `sales_person_id`) — sending both is harmless if one is
// unrecognized, and cheap insurance against a required-field rejection.
//
// exchange_rate — confirmed 2026-07-16 via direct API test that
// ExchangeRate/GetExchangeRate is a distinct required lookup alongside
// currency_id (not implied by it) — see useExchangeRate.
//
// tax_amount — confirmed 2026-07-16 our POS invoice document type
// (DocumentNumbering document_id 54) has is_tax_applicable: true, and every
// Item entity carries its own tax_template_id/is_tax_applicable/
// is_tax_inclusive, so per-line-item GST is ultimately the server's to
// compute. In the meantime we now send our own flat-3%-GST total (see
// cartSlice) as a best-effort tax_amount rather than omitting the field —
// once Invoice/Create is unblocked, reconcile against whatever
// Invoice/Retrieve reports back and drop this client-side figure if the
// server's per-item total disagrees.
//
// STATUS is DERIVED after posting (balance_amount + receipt_amount) — never sent.
//
// HEADER FIELDS — confirmed live 2026-07-28 by capturing a real, successful
// Order/Create request from OrnaVerse's own frontend (see
// useOrderHeaderConfig.js). Every prior 500 on this family of endpoints
// (Invoice/Order/SchemeReceipt Create) traced back to an entire missing tier
// of header fields that the 400 validation never flagged:
//   financial_year_id — from FinancialYear/List, matched to today's date.
//     NOT a customer or document field; not implied by document_date.
//   ledger_id — the document TYPE's own control ledger (DocumentNumberingRow,
//     keyed by document_id+company_id) — NOT the customer's receivable
//     ledger, confirmed via v1.json (CustomerRow has no bare ledger_id).
//   is_tax_applicable/auto_posting/is_document_number_editable — same
//     DocumentNumbering row; genuinely per-document-type config, not
//     universal constants, so sourced from there rather than hardcoded.
//   round_off — rounding adjustment between computed and collected amount;
//     we don't round display prices, so 0 is correct here.
//   allow_backdated_entry/number_of_backdated_days — POS sales are always
//     same-day; no backdating UI exists, so false/0.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { createInvoice, postInvoice } from '@/services/orderService';
import { useCart } from '@/hooks/cart/useCart';
import { useCartTotals } from '@/hooks/cart/useCartTotals';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';
import { useExchangeRate } from '@/hooks/checkout/useExchangeRate';
import { useOrderHeaderConfig } from '@/hooks/checkout/useOrderHeaderConfig';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';
import TOAST from '@/constants/toastMessages';
import tracker from '@/lib/analytics/tracker';
import EVENTS, { GA_ECOMMERCE_EVENTS } from '@/lib/analytics/events';

function toGAItems(items) {
  return items.map((item) => ({
    item_id:   String(item.itemId),
    item_name: item.itemName,
    item_sku:  item.sku,
    price:     item.unitPrice,
    quantity:  item.quantity,
  }));
}

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
 *   salesPersonId:  number,
 *   exchangeRate:   number,
 * }} params
 */
function buildInvoiceEntity({
  items, subtotal, discount, tax, total,
  customerId, activeStoreId,
  paymentModes, narration,
  salesPersonId, exchangeRate,
  headerConfig,
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
    // taxable_amount — confirmed required 2026-07-27: a live Invoice/Create
    // attempt 400'd with "Taxable amount is missing" once AccessDenied was
    // resolved for real. Pre-tax line value (same figure as sub_total here
    // since there's no per-line discount split yet) — server computes its
    // own tax off this, we don't send a per-line tax figure.
    taxable_amount: +(item.unitPrice * item.quantity).toFixed(2),
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
    exchange_rate: exchangeRate,
    employee_id:      salesPersonId,
    sales_person_id:  salesPersonId,
    sub_total:     subtotal,
    discount:      discount ?? 0,
    // header-level taxable_amount — the pre-tax value tax is computed on
    // (subtotal net of discount), mirroring the per-line-item field below.
    taxable_amount: +Math.max(0, subtotal - (discount ?? 0)).toFixed(2),
    tax_amount:    tax ?? 0,
    net_amount:    total,
    round_off:     0,
    narration:     narration ?? undefined,
    document_id:                 APP_CONFIG.DOCUMENT_TYPES.POS_INVOICE,
    financial_year_id:           headerConfig.financialYearId,
    ledger_id:                   headerConfig.ledgerId,
    is_tax_applicable:           headerConfig.isTaxApplicable,
    auto_posting:                headerConfig.autoPosting,
    is_document_number_editable: headerConfig.isDocumentNumberEditable,
    allow_backdated_entry:       false,
    number_of_backdated_days:    0,
    is_einvoice:                 false,
    line_items,
    receipt_details,
  };
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { items, clearCart } = useCart();
  const { subtotal, discount, tax, total } = useCartTotals();
  const { customerId } = useCustomerSession();
  const activeStoreId = useSelector(selectActiveStoreId);
  const { exchangeRate } = useExchangeRate();
  const headerConfig = useOrderHeaderConfig(APP_CONFIG.DOCUMENT_TYPES.POS_INVOICE);

  const mutation = useMutation({
    /**
     * @param {{
     *   paymentModes:  { modeId, modeCode, modeName, amount }[],
     *   narration?:    string,
     *   salesPersonId: number,
     * }} params
     */
    mutationFn: async ({ paymentModes, narration, salesPersonId }) => {
      if (!headerConfig.isReady) {
        throw new Error('Store configuration is still loading — please try again in a moment');
      }

      const entity = buildInvoiceEntity({
        items, subtotal, discount, tax, total,
        customerId, activeStoreId,
        paymentModes, narration,
        salesPersonId, exchangeRate,
        headerConfig,
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

      tracker.trackEcommerce(GA_ECOMMERCE_EVENTS.PURCHASE, EVENTS.ORDER_PLACED, {
        transaction_id: transactionId,
        value:          total,
        currency:       APP_CONFIG.CURRENCY.INR_CODE,
        items:          toGAItems(items),
      });

      clearCart();
      // Invalidate invoice + order list caches5
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },

    onError: (error) => {
      console.error('[useCreateInvoice]', error);

      const failedAtPost = error?.message?.includes('post');
      tracker.track(EVENTS.ORDER_FAILED, {
        stage: failedAtPost ? 'post' : 'create',
        value: total,
        error: error?.response?.data?.Error?.Message ?? error?.message ?? 'unknown',
      });

      // If create succeeded but post failed, the draft sits on the server.
      // The user can re-attempt posting from the invoices list.
      if (failedAtPost) {
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