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
// MONEY — nothing on this header is computed here. Every figure is summed
// from the line items, which arrive priced by Helpers/SetSalesItems and then
// discounted and RE-TAXED by Helper/ApplyPromotions. The cart's flat-3%-GST
// figure is a display estimate for the cart screen only and never reaches a
// document. See useCheckoutPricing.
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
// PROMOTIONS — confirmed 2026-08-05 by capturing their own Order counter.
// A promotion is priced by Helper/ApplyPromotions over the LINE ITEMS before
// Create (not on a saved draft, which is what this codebase used to assume),
// and its `invoice_promotions[]` response IS this document's
// promotion_details[], passed through untouched. Their reference sale:
// discount 12,177.60, taxable 1,04,699.04 → 92,521.44, tax 3,140.98 →
// 2,775.64, net 95,297. See promotionService.applyPromotions.
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
//   round_off — rounding adjustment between the computed net and the whole
//     rupee actually recorded.
//   allow_backdated_entry false (no backdating UI); number_of_backdated_days
//     comes from the document type's own config — their Order header sends
//     60, not 0, so it is read from headerConfig rather than hardcoded.
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
// sub_total/discount/taxable_amount/tax_amount/net_amount are summed from
// these authoritative per-line figures (summarizeLineItems).
//
// RECEIPT DETAILS carry fifteen fields, not the four this hook used to send —
// notably ledger_id, mode_type and mode_sub_type, all of which are already on
// the PaymentReceiptMode row and were simply being dropped. See
// lib/checkout/documentFields.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { createInvoice, postInvoice } from '@/services/orderService';
import {
  buildPricedLineItems,
  applyPromotionsToLines,
  summarizeLineItems,
} from '@/services/checkoutPricingService';
import { localDocumentDate, buildReceiptDetails } from '@/lib/checkout/documentFields';
import { useCart } from '@/hooks/cart/useCart';
import { useCartTotals } from '@/hooks/cart/useCartTotals';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';
import { useExchangeRate } from '@/hooks/checkout/useExchangeRate';
import { useOrderHeaderConfig } from '@/hooks/checkout/useOrderHeaderConfig';
import { selectActiveStoreId, selectActiveStoreCode, selectActiveStoreName } from '@/store/slices/storeSlice';
import { selectCartCustomerAddress } from '@/store/slices/cartSlice';
import APP_CONFIG from '@/constants/appConfig';
import TOAST from '@/constants/toastMessages';
import { trackDocumentPlaced, trackDocumentFailed } from '@/lib/analytics/orderTracking';

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
  lineItems, promotionDetails,
  customerId, customerName, customerMobile,
  activeStoreId,
  paymentModes, narration,
  salesPersonId, exchangeRate,
  headerConfig,
  fulfillmentOrderId, fulfillmentOrderNo,
}) {
  const today = localDocumentDate();
  const {
    subTotal, discount, taxableAmount, taxAmount, netAmount,
    pieces, weight, netWeight,
  } = summarizeLineItems(lineItems);

  // Nothing is subtracted here any more. The lines come back from
  // Helper/ApplyPromotions already discounted and re-taxed, so the header is
  // a straight sum of them — which is exactly what their own header is,
  // confirmed field for field against a real Order/Create.
  const roundedNet = Math.round(netAmount);
  const round_off  = +(roundedNet - netAmount).toFixed(2);

  const receipt_details = buildReceiptDetails({
    paymentModes, customerId, activeStoreId, exchangeRate, headerConfig,
  });
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
    // NOTE their header also carries `email`. Not sent: the cart session
    // stores id/name/mobile only, and our documents have always posted
    // correctly without it. Plumbing a new field through every attach path
    // for an optional denormalized copy wasn't worth it here.
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
    // base_* hold the PRE-discount figures on their payload — the line items
    // returned by ApplyPromotions carry base_net_amount 107840.02 against
    // net_amount 95297.08. Header base_sub_total/base_tax_amount mirror the
    // post-discount values in their capture, so those are summed as-is.
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
    // From the document type's own config, not hardcoded — their Order header
    // sends 60, which is document 53's configured backdating window.
    number_of_backdated_days:    headerConfig.numberOfBackdatedDays ?? 0,
    is_einvoice:                 false,
    line_items: lineItems,
    receipt_details,
    // The `invoice_promotions[]` rows Helper/ApplyPromotions returned, passed
    // through UNTOUCHED — which is exactly what their client does. This used
    // to go out empty because the row's shape could not be guessed; it no
    // longer has to be, because the server hands it to us fully formed.
    promotion_details: promotionDetails ?? [],
    // "Fulfill from order" — best-effort reference back to the source Order,
    // mirroring the shape OrnaVerse's own client builds client-side
    // (hydrateInvoiceCartFromOrder: fulfillment_order_id/fulfillment_order_no)
    // — see the header comment on API.ORDER_FULFILLMENT. UNVERIFIED whether
    // the server actually uses these to close the source order out; sending
    // them is cheap insurance (harmless if unrecognized), not confirmed to
    // be load-bearing. Omitted entirely for a normal (non-fulfillment) sale,
    // matching how bank_pos is omitted for Cash elsewhere in this file.
    ...(fulfillmentOrderId != null ? {
      is_fulfillment:       true,
      fulfillment_order_id: fulfillmentOrderId,
      fulfillment_order_no: fulfillmentOrderNo,
    } : {}),
  };
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { items, appliedPromos, fulfillmentOrderId, fulfillmentOrderNo } = useCart();
  // Cart total is a FALLBACK for analytics only. Every money figure on the
  // document now comes from the priced, promotion-applied line items.
  const { total: cartTotal } = useCartTotals();
  const { customerId, customerName, customerMobile } = useCustomerSession();
  const customerAddress = useSelector(selectCartCustomerAddress);
  const activeStoreId   = useSelector(selectActiveStoreId);
  const activeStoreCode = useSelector(selectActiveStoreCode);
  const activeStoreName = useSelector(selectActiveStoreName);
  const { exchangeRate } = useExchangeRate();
  const headerConfig = useOrderHeaderConfig(APP_CONFIG.DOCUMENT_TYPES.POS_INVOICE);

  const mutation = useMutation({
    /**
     * @param {{
     *   paymentModes:  { modeId, modeCode, modeName, amount, ledgerId?, raw? }[],
     *   narration?:    string,
     *   salesPersonId: number,
     *   pricedLineItems?:  object[],  // post-promotion lines from useCheckoutPricing
     *   promotionDetails?: object[],  // its invoice_promotions rows
     * }} params
     */
    mutationFn: async ({
      paymentModes, narration, salesPersonId, pricedLineItems,
      promotionDetails: promotionDetailsArg,
    }) => {
      if (!headerConfig.isReady) {
        if (headerConfig.isError) headerConfig.refetch();
        throw new Error(
          headerConfig.isConfigMissing
            ? "This document type isn't set up for your store yet — contact OrnaVerse support"
            : headerConfig.isError
              ? 'Store configuration failed to load — retrying now, please try again in a moment'
              : 'Store configuration is still loading — please try again in a moment'
        );
      }

      const documentId = APP_CONFIG.DOCUMENT_TYPES.POS_INVOICE;

      // Prefer the lines the checkout screen already priced and quoted from
      // (useCheckoutPricing) — they already have the promotions applied and
      // re-taxed. Re-pricing here would risk billing a different figure than
      // the one the customer was just shown and charged, and would repeat the
      // two slowest calls in the flow. Falls back for any caller that doesn't
      // pre-price, in which case the promotions have to be applied here too
      // or the discount would silently vanish from the document.
      let lineItems;
      let promotionDetails;

      if (pricedLineItems) {
        lineItems = pricedLineItems.map((row) => ({ ...row, sales_person_id: salesPersonId }));
        promotionDetails = promotionDetailsArg ?? [];
      } else {
        const { lineItems: priced } = await buildPricedLineItems({
          items, activeStoreId, salesPersonId,
        });
        const promoted = await applyPromotionsToLines({
          lineItems: priced, appliedPromos, documentId, exchangeRate,
        });
        lineItems = promoted.lineItems;
        promotionDetails = promoted.promotionDetails;
      }

      const entity = buildInvoiceEntity({
        lineItems, promotionDetails,
        customerId, customerName, customerMobile,
        activeStoreId,
        paymentModes, narration,
        salesPersonId, exchangeRate,
        headerConfig,
        fulfillmentOrderId, fulfillmentOrderNo,
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

      // entity + lineItems travel back (not just netAmount) so onSuccess can
      // report the full order — price breakup, per-item detail — not just
      // the total. It used to report the cart's catalog total, which since
      // checkout started pricing the real pieces has been a different — and
      // on stone-set items, much smaller — number than the sale.
      return { transactionId, createResponse, postResponse, entity, lineItems };
    },

    onSuccess: ({ transactionId, entity, lineItems }, variables) => {
      toast.success(TOAST.INVOICES.CREATED(transactionId));

      trackDocumentPlaced({
        documentType: 'invoice',
        transactionId, entity, lineItems,
        customerId, customerName, customerMobile, customerAddress,
        activeStoreId, activeStoreCode, activeStoreName,
        paymentModes:  variables?.paymentModes,
        salesPersonId: variables?.salesPersonId,
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

    onError: (error, variables) => {
      console.error('[useCreateInvoice]', error);

      const failedAtPost = error?.stage === 'post';
      // Nothing was invoiced, so report what the counter was trying to
      // collect rather than the cart's unrelated estimate.
      const attemptedValue = variables?.paymentModes
        ?.reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? cartTotal;
      // normalizeError (lib/axios/interceptors.js) lifts OrnaVerse's own
      // `Error.Message` onto serverMessage. Show it: "Not enough stock of
      // 21278E2 can not Save" tells the counter what to do next, whereas
      // "Please try again" invites them to retry something that cannot
      // succeed.
      const reason = error?.serverMessage ?? error?.message ?? null;

      trackDocumentFailed({
        documentType: 'invoice',
        stage: failedAtPost ? 'post' : 'create',
        value: attemptedValue,
        error: reason ?? 'unknown',
      });

      // If create succeeded but post failed, the draft sits on the server —
      // error.transactionId is stamped above specifically so this can name
      // it. That fact (and which ref number to go find) matters more than
      // whatever raw reason the failed Post call carries, so it always wins
      // over `reason` here — see TOAST.INVOICES.POST_FAILED's own comment.
      if (failedAtPost && error?.transactionId) {
        toast.error(TOAST.INVOICES.POST_FAILED(error.transactionId));
        return;
      }

      toast.error(reason ?? TOAST.INVOICES.CREATE_FAILED);
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