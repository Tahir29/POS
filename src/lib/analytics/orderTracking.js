// src/lib/analytics/orderTracking.js
//
// Shared purchase-funnel tracking for BOTH checkout documents —
// useCreateOrder.js (deposit/reserve, POS/Order) and useCreateInvoice.js
// (immediate sale, POS/Invoice) — so both flows carry the same depth of
// detail instead of two independently hand-written (and drifting) events.
//
// GA4 vs WebEngage split follows tracker.js's rule (see its jsdoc): only
// real customer identity (name/mobile/address) and free-text narration go
// into webengageExtra. Everything else — full per-item product detail,
// the order-level price breakup, store context, sales_person_id — is not
// PII and goes to both destinations via the shared params/items[].

import tracker from './tracker';
import EVENTS, { GA_ECOMMERCE_EVENTS } from './events';
import APP_CONFIG from '@/constants/appConfig';

// One row per physical piece, so `quantity` is always 1 per row here — that
// mirrors how many rows exist, it's not a bug. `price` is sub_total
// (pre-tax headline price), not net_amount (post-tax total).
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
 * @param {string} [salesPersonName] — resolved the same way SalesPersonSelect
 *   does (see checkout/page.jsx), so reports show a readable name, not just an id.
 */
export function trackDocumentPlaced({
  documentType, transactionId, entity, lineItems,
  customerId, customerName, customerMobile, customerAddress,
  activeStoreId, activeStoreCode, activeStoreName,
  paymentModes, salesPersonId, salesPersonName,
}) {
  const modes = paymentModes ?? [];
  const paymentSummary = modes
    .map((p) => `${p.modeCode ?? p.modeName ?? 'mode'}:${p.amount}`)
    .join(', ') || undefined;
  // Single clean value for the common single-payment-mode case, so a report
  // doesn't have to parse payment_modes' joined string. Null for a genuine
  // split payment (two or more modes) — there's no one "the" method then.
  const paymentMethod = modes.length === 1 ? (modes[0].modeCode ?? modes[0].modeName ?? null) : null;

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
    sales_person_id:   salesPersonId,
    sales_person_name: salesPersonName ?? null,
    payment_method:  paymentMethod,
    payment_modes:   paymentSummary,
    payment_mode_count: modes.length,
    store_id:        activeStoreId,
    store_code:      activeStoreCode,
    store_name:      activeStoreName,
    items:           toOrderItems(lineItems),
  }, {
    // WebEngage-only — real customer identity + free text; GA4 never
    // receives these (see tracker.js's jsdoc). customer_id defaults to
    // 'guest' (same convention as tracker.js's GUEST_ID) for a walk-in cash
    // sale with no registered customer.
    customer_id:      customerId ?? 'guest',
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
