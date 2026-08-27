// src/lib/analytics/orderTracking.js
//
// Shared purchase-funnel tracking for BOTH checkout documents —
// useCreateOrder.js (deposit/reserve, POS/Order) and useCreateInvoice.js
// (immediate sale, POS/Invoice). Built 2026-08-27 because useCreateOrder.js
// fired NO tracking at all up to this point (see its own header comment on
// how easy it is for this document type to go quietly unwired), while
// useCreateInvoice.js fired a GA-only, thin (`items: [{item_id, item_name,
// item_sku, price, quantity}]`) purchase event with nothing extra ever sent
// to WebEngage. One shared builder here means both flows carry the same
// depth of detail and can never drift the way two hand-written copies would.
//
// GA4 vs WebEngage split follows the SAME rule tracker.js documents
// throughout (see its jsdoc on track()/trackEcommerce()): everything below
// that is NOT customer PII goes in the shared params/items[] — both
// destinations get it, GA4 included, since none of it is name/email/phone:
//   - full per-item product detail (category, brand, karat, metal, colour,
//     weight, sku) — the same non-PII product vocabulary the product-detail
//     page's WebEngage-only bag already sends, now brought to GA4 too, on
//     the same event, exactly at parity.
//   - the full order-level price breakup (sub_total/discount/taxable_amount/
//     tax_amount/round_off/receipt_amount/balance_amount) — none of these
//     are PII either; GA4's own purchase event already has reserved `tax`
//     and `shipping` params for exactly this kind of detail.
//   - store context (company id/code/name) and sales_person_id (an
//     employee id, not a customer's).
// Only real customer identity (name/mobile/address) and free-text narration
// go into webengageExtra — GA4 never sees those, same as everywhere else.

import tracker from './tracker';
import EVENTS, { GA_ECOMMERCE_EVENTS } from './events';
import APP_CONFIG from '@/constants/appConfig';

// One row per physical piece (see checkoutPricingService.buildPricedLineItems'
// own comment: "Both pricing paths emit ONE ROW PER PIECE"), so `quantity` is
// always 1 per row here — that's correct, not a bug, it mirrors how many
// rows exist. `price` mirrors the product-detail page's own headline price
// (sub_total — pre-tax, the figure that page and this line item agree on),
// not net_amount (which is this row's own post-tax total).
function toOrderItems(lineItems = []) {
  return lineItems.map((row) => ({
    item_id:           row.item_id != null ? String(row.item_id) : undefined,
    item_name:         row.item_name ?? undefined,
    item_sku:          row.sku ?? row.item_code ?? undefined,
    item_category:     row.type_name ?? row.item_group_name ?? undefined,
    item_sub_category: row.sub_type_name ?? undefined,
    item_brand:        row.brand_name ?? undefined,
    item_collection:   row.collection_name ?? undefined,
    item_karat:        row.karat_name ?? undefined,
    item_metal:        row.metal_name ?? undefined,
    item_color:        row.metal_color_name ?? undefined,
    item_size:         row.item_size_name ?? undefined,
    item_weight:       row.net_weight ?? row.weight ?? undefined,
    price:             row.sub_total ?? row.item_rate ?? undefined,
    quantity:          row.pieces ?? 1,
  }));
}

/**
 * Fire once a document (Order OR Invoice) is successfully created — and
 * posted, when the document type doesn't auto-post.
 *
 * @param {'order'|'invoice'} documentType — tags the event so the two
 *   funnels stay distinguishable in reporting despite sharing
 *   EVENTS.ORDER_PLACED (an Order here is a deposit/reserve, not a
 *   completed sale — see useCreateOrder.js's header for why they're
 *   deliberately two different documents, not two labels for one thing).
 * @param {number} transactionId
 * @param {object} entity — the built OrderRow/InvoiceRow (buildOrderEntity/
 *   buildInvoiceEntity's return value) — its header fields ARE the order's
 *   price breakup, summed from the same priced lines checkout quoted from.
 * @param {object[]} lineItems — the priced line items on that entity.
 * @param {{customerId, customerName, customerMobile, customerAddress}} customer
 * @param {{activeStoreId, activeStoreCode, activeStoreName}} store
 * @param {{modeCode?, modeName?, amount}[]} paymentModes
 * @param {number} salesPersonId
 */
export function trackDocumentPlaced({
  documentType, transactionId, entity, lineItems,
  customerId, customerName, customerMobile, customerAddress,
  activeStoreId, activeStoreCode, activeStoreName,
  paymentModes, salesPersonId,
}) {
  const paymentSummary = (paymentModes ?? [])
    .map((p) => `${p.modeCode ?? p.modeName ?? 'mode'}:${p.amount}`)
    .join(', ') || undefined;

  tracker.trackEcommerce(GA_ECOMMERCE_EVENTS.PURCHASE, EVENTS.ORDER_PLACED, {
    document_type:  documentType,
    transaction_id: transactionId,
    currency:       APP_CONFIG.CURRENCY.INR_CODE,
    value:          entity.net_amount,
    tax:            entity.tax_amount,
    sub_total:      entity.sub_total,
    discount:       entity.discount,
    taxable_amount: entity.taxable_amount,
    round_off:      entity.round_off,
    receipt_amount: entity.receipt_amount,
    balance_amount: entity.balance_amount,
    pieces:         entity.pieces,
    weight:         entity.weight,
    net_weight:     entity.net_weight,
    sales_person_id: salesPersonId,
    payment_modes:   paymentSummary,
    store_id:        activeStoreId,
    store_code:      activeStoreCode,
    store_name:      activeStoreName,
    items:           toOrderItems(lineItems),
  }, {
    // WebEngage-only — real customer identity + free text. Same PII rule as
    // everywhere else (see tracker.js's jsdoc); GA4 never receives these.
    customer_id:      customerId,
    customer_name:    customerName,
    customer_mobile:  customerMobile,
    customer_city:    customerAddress?.city,
    customer_state:   customerAddress?.state,
    customer_country: customerAddress?.country,
    customer_zip:     customerAddress?.zip,
    narration:        entity.narration,
  });
}

/**
 * Fire when either document's create/post step fails.
 * @param {'order'|'invoice'} documentType
 * @param {'create'|'post'} stage
 * @param {number} value — what the counter was trying to collect/save.
 * @param {string} error — normalized server/error message.
 */
export function trackDocumentFailed({ documentType, stage, value, error }) {
  tracker.track(EVENTS.ORDER_FAILED, {
    document_type: documentType,
    stage,
    value,
    error,
  });
}
