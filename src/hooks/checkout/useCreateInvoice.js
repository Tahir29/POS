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
//   document_id — confirmed live: the document TYPE (not just a
//     DocumentNumbering lookup key) is a required header field in its own
//     right. document_no, by contrast, must NOT be sent — the server
//     assigns it (proven live 2026-07-29; see the note at the bottom of
//     documentConfigService.js for why computing it client-side is unsafe).
//
// LINE ITEMS — confirmed live 2026-07-28 (after the header fix alone still
// 500'd) that each line item must be the FULL computed Helpers/SetSalesItems
// object (item_components[]/item_operations[]/item_taxes[]/hsn/
// tax_template_id, ~70 fields) — NOT a hand-rolled summary. See
// checkoutPricingService.buildPricedLineItems, which re-fetches each cart
// item's master record and re-prices it against TODAY's rates at
// submission time (not whatever was cached at add-to-cart). Header
// sub_total/taxable_amount/tax_amount/net_amount are now summed from these
// authoritative per-line figures (summarizeLineItems) rather than the
// cart's own flat-3%-GST display estimate — the two should closely agree
// since 3% IS the real combined CGST+SGST rate for jewellery, but the
// server's own per-item computation is the one actually submitted.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { createInvoice, postInvoice } from '@/services/orderService';
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
 * Builds InvoiceRow Entity from already-priced line items + session state.
 * Field names confirmed against OrnaVerse.POS.InvoiceRow +
 * OrnaVerse.POS.InvoiceItemsRow + OrnaVerse.POS.InvoiceReceiptRow (v1.json).
 *
 * @param {{
 *   lineItems:      object[], // buildPricedLineItems() output
 *   discount:       number,
 *   customerId:     number,
 *   customerName:   string,
 *   customerMobile: string,
 *   activeStoreId:  number,
 *   paymentModes:   { modeId, modeCode, modeName, amount }[],
 *   narration?:     string,
 *   salesPersonId:  number,
 *   exchangeRate:   number,
 *   headerConfig:   ReturnType<typeof useOrderHeaderConfig>,
 * }} params
 */
function buildInvoiceEntity({
  lineItems, discount,
  customerId, customerName, customerMobile,
  activeStoreId,
  paymentModes, narration,
  salesPersonId, exchangeRate,
  headerConfig,
}) {
  const today = new Date().toISOString();
  const { subTotal, taxableAmount, taxAmount, netAmount, pieces, weight, netWeight } =
    summarizeLineItems(lineItems);

  const discountedNet = +Math.max(0, netAmount - (discount ?? 0)).toFixed(2);
  // round_off — the rounding adjustment between the raw computed total and
  // the amount actually recorded, mirroring the real captured payload
  // (base_net_amount 128523.16 → net_amount 128523, round_off -0.16).
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
    // party_name/mobile/user_id — confirmed live 2026-07-28: the header
    // denormalizes the customer identity too (not just party_id); omitting
    // these was part of what still 500'd even with every other field
    // correct. user_id is null on the real captured example even for a
    // real logged-in staff session — not something to guess further.
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
    line_items: lineItems,
    receipt_details,
    promotion_details: [],
  };
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { items } = useCart();
  const { discount, total } = useCartTotals();
  const { customerId, customerName, customerMobile } = useCustomerSession();
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
    mutationFn: async ({ paymentModes, narration, salesPersonId, pricedLineItems }) => {
      if (!headerConfig.isReady) {
        throw new Error('Store configuration is still loading — please try again in a moment');
      }

      // Prefer the lines the checkout screen already priced and quoted from
      // (useCheckoutPricing). Re-pricing here would risk billing a different
      // figure than the one the customer was just shown and charged, and
      // would repeat the slowest call in the flow. Falls back to pricing
      // now for any caller that doesn't pre-price.
      const lineItems = pricedLineItems
        ? pricedLineItems.map((row) => ({ ...row, sales_person_id: salesPersonId }))
        : await buildPricedLineItems({
            items, activeStoreId, salesPersonId,
            documentId: APP_CONFIG.DOCUMENT_TYPES.POS_INVOICE,
          });

      const entity = buildInvoiceEntity({
        lineItems, discount,
        customerId, customerName, customerMobile,
        activeStoreId,
        paymentModes, narration,
        salesPersonId, exchangeRate,
        headerConfig,
      });

      // Step 1: Create draft invoice.
      // `stage` is stamped on the error rather than sniffed out of the
      // message afterwards — the old check (`message.includes('post')`)
      // tested the NORMALIZED message, which never contains the word, so
      // every post-stage failure was misreported as a create failure.
      let createResponse;
      try {
        createResponse = await createInvoice(entity);
      } catch (err) {
        err.stage = 'create';
        throw err;
      }
      const transactionId = createResponse?.EntityId;

      if (!transactionId) {
        const err = new Error('Invoice creation failed — no EntityId returned');
        err.stage = 'create';
        throw err;
      }

      // Step 2: Post (finalise) — triggers stock deduction + accounting.
      // SKIPPED when the document type auto-posts. Confirmed live
      // 2026-07-30: with auto_posting:true (which is how this store's POS
      // document types are configured), Create already posts — Retrieve
      // comes back with posting_date/posted_by populated — and a follow-up
      // Post fails with {"Code":"AlreadyPosted"}. Posting twice isn't just
      // redundant, it surfaces as a failed sale to the operator.
      let postResponse = null;
      if (!headerConfig.autoPosting) {
        try {
          postResponse = await postInvoice(transactionId);
        } catch (err) {
          err.stage = 'post';
          err.transactionId = transactionId;
          throw err;
        }
      }

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

      // NOT clearing the cart here. Clearing resets the attached customer,
      // and the checkout screen's own guards (redirect-on-customer-change,
      // redirect-when-cart-empty) are switched off by `invoiceResult` being
      // set — which React Query only does AFTER this callback. That one
      // render in between was enough to bounce the operator to /cart and
      // they never saw the confirmation screen or the invoice number.
      // The screen clears the cart itself once confirmation is on screen.
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },

    onError: (error) => {
      console.error('[useCreateInvoice]', error);

      const failedAtPost = error?.stage === 'post';
      // normalizeError (lib/axios/interceptors.js) lifts OrnaVerse's own
      // `Error.Message` onto serverMessage. Show it: "Not enough stock of
      // 21278E2 can not Save" tells the counter what to do next, whereas
      // "Please try again" invites them to retry something that cannot
      // succeed.
      const reason = error?.serverMessage ?? error?.message ?? null;

      tracker.track(EVENTS.ORDER_FAILED, {
        stage: failedAtPost ? 'post' : 'create',
        value: total,
        error: reason ?? 'unknown',
      });

      // If create succeeded but post failed, the draft sits on the server.
      // The user can re-attempt posting from the invoices list.
      const fallback = failedAtPost
        ? TOAST.INVOICES.POST_FAILED
        : TOAST.INVOICES.CREATE_FAILED;

      toast.error(reason ?? fallback);
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