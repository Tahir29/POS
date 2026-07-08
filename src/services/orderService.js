// src/services/orderService.js
// POS Orders and Invoices — all via native POS endpoints.
// MarketPlace/Order/Generate has been replaced by POS/Order/Create → Post.
//
// ORDER FLOW:
//   1. createOrder()  → POST POS/Order/Create  → returns { EntityId: transaction_id }
//   2. postOrder()    → POST POS/Order/Post     → finalises, triggers stock deduction
//
// INVOICE FLOW (preferred for direct billing):
//   1. createInvoice() → POST POS/Invoice/Create → returns { EntityId: transaction_id }
//   2. postInvoice()   → POST POS/Invoice/Post   → finalises, triggers accounting
//
// SCHEMA — POS.OrderRow / POS.InvoiceRow key fields (confirmed v1.json):
//   transaction_id   — primary key (int64)
//   document_no      — order/invoice number (string)
//   document_date    — date (datetime string)
//   party_id         — customer (int32)
//   party_name       — customer name (readOnly, joined)
//   net_amount       — total amount (double)
//   sub_total        — subtotal before discount (double)
//   discount         — discount amount (double)
//   tax_amount       — tax (double)
//   receipt_amount   — amount paid (double)
//   balance_amount   — amount outstanding (double)
//   line_items[]     — OrderItemsRow / InvoiceItemsRow
//   receipt_details[]— OrderReceiptRow / InvoiceReceiptRow
//   promotion_details[]— OrderPromotionRow
//
// STATUS (derived — no status field in schema):
//   balance_amount <= 0                          → "paid"
//   balance_amount > 0 && receipt_amount > 0     → "partial"
//   balance_amount > 0 && receipt_amount == 0    → "due"
//
// ORDER LINE ITEM (OrderItemsRow) price field = item_rate (not catalog price)

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

// ─── ORDERS ───────────────────────────────────────────────────────────────────

/**
 * Paginated list of POS orders for the active store.
 * @param {{ take?: number, skip?: number, company_id?: number }} params
 * @returns {Promise<object>} { Entities[], TotalCount }
 */
export async function getOrders({ take = 50, skip = 0, company_id } = {}) {
  const response = await axiosInstance.post(API.ORDERS.LIST, {
    Take:       take,
    Skip:       skip,
    company_id: company_id ?? undefined,
  });
  return response.data;
}

/**
 * Full detail of a single POS order.
 * @param {number} orderId — transaction_id from Order/List
 * @returns {Promise<object>} { Entity: OrderRow }
 */
export async function getOrderDetail(orderId) {
  const response = await axiosInstance.post(API.ORDERS.RETRIEVE, {
    EntityId: orderId,
  });
  return response.data;
}

/**
 * Create a draft POS order.
 * Returns { EntityId } — the transaction_id to use in postOrder().
 *
 * Payload shape (OrderRow):
 *   { party_id, company_id, document_date, currency_id,
 *     line_items[], receipt_details[], promotion_details[] }
 *
 * @param {object} orderEntity — OrderRow fields
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function createOrder(orderEntity) {
  const response = await axiosInstance.post(API.ORDERS.CREATE, {
    Entity: orderEntity,
  });
  return response.data;
}

/**
 * Post (finalise) a draft POS order.
 * Triggers stock deduction and ledger entries.
 * @param {number} transactionId — EntityId from createOrder()
 * @returns {Promise<object>} PostResponse
 */
export async function postOrder(transactionId) {
  const response = await axiosInstance.post(API.ORDERS.POST, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Update a draft POS order before posting.
 * @param {number} transactionId
 * @param {object} orderEntity — updated OrderRow fields
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function updateOrder(transactionId, orderEntity) {
  const response = await axiosInstance.post(API.ORDERS.UPDATE, {
    EntityId: transactionId,
    Entity:   orderEntity,
  });
  return response.data;
}

/**
 * Cancel a POS order.
 * @param {number} transactionId
 * @returns {Promise<object>} OrnaVerse response
 */
export async function cancelOrder(transactionId) {
  const response = await axiosInstance.post(API.ORDERS.CANCEL, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Apply an additional discount to a draft order.
 * Returns updated line items with recalculated amounts.
 * @param {{ transaction_id: number, additional_discount: number }} params
 * @returns {Promise<object>} { Entities: OrderItemsRow[] }
 */
export async function applyOrderDiscount({ transaction_id, additional_discount }) {
  const response = await axiosInstance.post(API.ORDERS.APPLY_DISCOUNT, {
    transaction_id,
    additional_discount,
  });
  return response.data;
}

// ─── INVOICES ─────────────────────────────────────────────────────────────────

/**
 * Paginated list of POS invoices for the active store.
 * @param {{ take?: number, skip?: number, company_id?: number }} params
 * @returns {Promise<object>} { Entities[], TotalCount }
 */
export async function getInvoiceList({ take = 100, skip = 0, company_id } = {}) {
  const response = await axiosInstance.post(API.INVOICES.LIST, {
    Take:       take,
    Skip:       skip,
    company_id: company_id ?? undefined,
  });
  return response.data;
}

/**
 * Full detail of a single POS invoice.
 * @param {number} invoiceId — transaction_id from Invoice/List
 * @returns {Promise<object>} { Entity: InvoiceRow }
 */
export async function getInvoiceDetail(invoiceId) {
  const response = await axiosInstance.post(API.INVOICES.RETRIEVE, {
    EntityId: invoiceId,
  });
  return response.data;
}

/**
 * Create a draft POS invoice.
 * Returns { EntityId } — the transaction_id to use in postInvoice().
 *
 * Payload shape (InvoiceRow):
 *   { party_id, company_id, document_date, currency_id,
 *     line_items[], receipt_details[], promotion_details[] }
 *
 * @param {object} invoiceEntity — InvoiceRow fields
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function createInvoice(invoiceEntity) {
  // TEMP DEBUG — remove once the Invoice/Create 500 exception is diagnosed.
  console.log('[createInvoice] outgoing Entity payload:', JSON.stringify(invoiceEntity, null, 2));

  const response = await axiosInstance.post(API.INVOICES.CREATE, {
    Entity: invoiceEntity,
  });
  return response.data;
}

/**
 * Post (finalise) a draft POS invoice.
 * Triggers stock deduction, accounting entries, and receipt posting.
 * @param {number} transactionId — EntityId from createInvoice()
 * @returns {Promise<object>} PostResponse
 */
export async function postInvoice(transactionId) {
  const response = await axiosInstance.post(API.INVOICES.POST, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Update a draft POS invoice before posting.
 * @param {number} transactionId
 * @param {object} invoiceEntity — updated InvoiceRow fields
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function updateInvoice(transactionId, invoiceEntity) {
  const response = await axiosInstance.post(API.INVOICES.UPDATE, {
    EntityId: transactionId,
    Entity:   invoiceEntity,
  });
  return response.data;
}

/**
 * Cancel a POS invoice.
 * @param {number} transactionId
 * @returns {Promise<object>} OrnaVerse response
 */
export async function cancelInvoice(transactionId) {
  const response = await axiosInstance.post(API.INVOICES.CANCEL, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Apply an additional discount to a draft invoice.
 * Returns updated line items with recalculated amounts.
 * @param {{ transaction_id: number, additional_discount: number }} params
 * @returns {Promise<object>} { Entities: InvoiceItemsRow[] }
 */
export async function applyInvoiceDiscount({ transaction_id, additional_discount }) {
  const response = await axiosInstance.post(API.INVOICES.APPLY_DISCOUNT, {
    transaction_id,
    additional_discount,
  });
  return response.data;
}

/**
 * Generate a server-side PDF for a posted invoice.
 * @param {number} transactionId
 * @returns {Promise<object>} OrnaVerse response (PDF URL or binary)
 */
export async function generateInvoicePDF(transactionId) {
  const response = await axiosInstance.post(API.INVOICES.GENERATE_PDF, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Day-wise sales list — used on the Reports/Dashboard page.
 * @param {{ from_date: string, to_date: string, company_id: number }} params
 * @returns {Promise<object>} OrnaVerse response
 */
export async function getDayWiseSales({ from_date, to_date, company_id }) {
  const response = await axiosInstance.post(API.INVOICES.DAY_WISE_SALES, {
    from_date,
    to_date,
    company_id,
  });
  return response.data;
}

// ─── INVOICE HELPERS (checkout balances) ──────────────────────────────────────
// Call these before rendering the payment section to show what the customer
// has available to apply toward this invoice.

/**
 * Get customer's available advance payments.
 * @param {{ party_id: number, company_id: number }} params
 */
export async function getInvoiceAdvances({ party_id, company_id }) {
  const response = await axiosInstance.post(API.INVOICE_HELPERS.GET_ADVANCES, {
    party_id,
    company_id,
  });
  return response.data;
}

/**
 * Get customer's available credit note balance.
 * @param {{ party_id: number, company_id: number }} params
 */
export async function getInvoiceCreditNote({ party_id, company_id }) {
  const response = await axiosInstance.post(API.INVOICE_HELPERS.GET_CREDIT_NOTE, {
    party_id,
    company_id,
  });
  return response.data;
}

/**
 * Get customer's available exchange value.
 * @param {{ party_id: number, company_id: number }} params
 */
export async function getInvoiceExchange({ party_id, company_id }) {
  const response = await axiosInstance.post(API.INVOICE_HELPERS.GET_EXCHANGE, {
    party_id,
    company_id,
  });
  return response.data;
}

/**
 * Get customer's available old gold value.
 * @param {{ party_id: number, company_id: number }} params
 */
export async function getInvoiceOldGold({ party_id, company_id }) {
  const response = await axiosInstance.post(API.INVOICE_HELPERS.GET_OLD_GOLD, {
    party_id,
    company_id,
  });
  return response.data;
}

/**
 * Get customer's available scheme balance (matured or available for redemption).
 * @param {{ party_id: number, company_id: number }} params
 */
export async function getInvoiceScheme({ party_id, company_id }) {
  const response = await axiosInstance.post(API.INVOICE_HELPERS.GET_SCHEME, {
    party_id,
    company_id,
  });
  return response.data;
}

/**
 * Get customer's daily cash position at this store.
 * @param {{ party_id: number, company_id: number }} params
 */
export async function getPartyDailyCash({ party_id, company_id }) {
  const response = await axiosInstance.post(API.INVOICE_HELPERS.GET_PARTY_DAILY_CASH, {
    party_id,
    company_id,
  });
  return response.data;
}

// ─── INVOICE RECEIPTS ─────────────────────────────────────────────────────────

/**
 * Create a payment receipt entry against an invoice.
 * @param {{
 *   transaction_id: number,
 *   mode_id:        number,
 *   mode_name:      string,
 *   amount:         number,
 *   ref_no?:        string
 * }} payload
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function createInvoiceReceipt(payload) {
  const response = await axiosInstance.post(API.INVOICE_RECEIPTS.CREATE, {
    Entity: payload,
  });
  return response.data;
}

/**
 * Validate a gift voucher code before applying it as a payment.
 * @param {{ voucher_code: string, company_id: number }} params
 * @returns {Promise<object>} Voucher validation response
 */
export async function validateInvoiceVoucher({ voucher_code, company_id }) {
  const response = await axiosInstance.post(API.INVOICE_RECEIPTS.VALIDATE_VOUCHER, {
    voucher_code,
    company_id,
  });
  return response.data;
}