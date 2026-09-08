// Customer order history — filtered by party_id from the full orders +
// invoices list. Checkout now raises ONE of two documents per sale (see
// checkout/page.jsx): an Invoice (54, in stock + paid in full) or an Order
// (53, advance/nothing/made-to-order) — OrderRow and InvoiceRow share their
// field names (see orderService.js), so both normalize identically here and
// a customer's history isn't missing whichever type a given sale happened
// to raise.
//
// STATUS: document_status (0 Draft / 1 Posted / 2 Cancelled) takes
// precedence — confirmed live 2026-09-03, a real Cancelled invoice
// (HO-LJ-0726-009, balance_amount: 0) was displaying as "Paid" because
// document_status was never looked at, only balance/receipt. Only a
// POSTED document's status is actually about payment progress:
//   document_status 2 (Cancelled)                              → "cancelled"
//   document_status 0 (Draft)                                  → "draft"
//   document_status 1 (Posted), balance_amount <= 0             → "paid"
//   document_status 1 (Posted), balance > 0 && receipt_amount>0 → "partial"
//   document_status 1 (Posted), balance > 0 && receipt_amount==0 → "due"

import APP_CONFIG from '@/constants/appConfig';

function isEmptyValue(v) {
  return v === null || v === undefined || v === 'NA' || v === '';
}

/**
 * Shared by normalizeCustomerOrder (below) and useInvoiceList.js's
 * normalizeInvoice — one place for the document_status precedence so the
 * customer profile Orders tab, /orders, and /invoices can't drift apart
 * on what "Cancelled" means again.
 * @param {number|null|undefined} documentStatus — 0 Draft / 1 Posted / 2 Cancelled
 * @param {number|null} balanceAmount
 * @param {number|null} receiptAmount
 * @returns {string} one of APP_CONFIG.ORDER_STATUS
 */
export function deriveDocumentStatus(documentStatus, balanceAmount, receiptAmount) {
  if (documentStatus === 2) return APP_CONFIG.ORDER_STATUS.CANCELLED;
  if (documentStatus === 0) return APP_CONFIG.ORDER_STATUS.DRAFT;

  if (balanceAmount != null && balanceAmount > 0) {
    return receiptAmount != null && receiptAmount > 0
      ? APP_CONFIG.ORDER_STATUS.PARTIAL
      : APP_CONFIG.ORDER_STATUS.DUE;
  }
  return APP_CONFIG.ORDER_STATUS.PAID;
}

/**
 * @param {object} entity — raw OrderRow or InvoiceRow
 * @param {'order'|'invoice'} documentType — which endpoint this came from;
 *   surfaced so a merged list (e.g. the Orders panel) can still tell them
 *   apart for display/actions, even though the fields below are identical.
 */
export function normalizeCustomerOrder(entity, documentType = 'order') {
  if (!entity) return null;
  const get = (key) => (!isEmptyValue(entity[key]) ? entity[key] : null);

  const balanceAmount = get('balance_amount');
  const receiptAmount = get('receipt_amount');
  const status = deriveDocumentStatus(entity.document_status, balanceAmount, receiptAmount);

  return {
    orderId:       get('transaction_id'),
    orderNo:       get('document_no'),
    orderDate:     get('document_date'),
    customerId:    get('party_id'),
    customerName:  get('party_name'),
    totalAmount:   get('net_amount'),
    balanceAmount,
    receiptAmount,
    status,
    companyId:     get('company_id'),
    companyName:   get('company_name'),
    lineItems:     Array.isArray(entity.line_items) ? entity.line_items : [],
    documentType,
    raw: entity,
  };
}

// REMOVED 2026-09-08 — the useCustomerOrders() hook that used to live here
// (a merged orders+invoices-by-customer fetch, using fetchStoreScopedDocuments)
// had zero callers anywhere in the app (confirmed via a dead-code audit —
// the customer profile page's own Orders/History tabs were fully subsumed
// by Customer 360 back on 2026-08-12, per that page's own TABS comment).
// deriveDocumentStatus/normalizeCustomerOrder above are NOT dead — they're
// still imported directly by useInvoiceList.js and useAllOrders.js — so
// only the unused hook itself was deleted, not this whole file. The
// Services/POS/Order/List + Invoice/List endpoints this hook called are
// untouched in apiEndpoints.js in case this needs rebuilding later.