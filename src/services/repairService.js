// src/services/repairService.js
// POS Repair workflow — full lifecycle management.
// All functions are pure HTTP wrappers — no business logic.
//
// REPAIR WORKFLOW:
//   1. RepairIn   — customer drops item at store (intake, assessment, estimation)
//   2. RepairOut  — item sent to craftsman/workshop for work
//   3. RepairInvoice — item returned to customer, billing raised
//
// Each stage has its own create/post flow.
// RepairInvoice has its own helpers (GET_SCHEME, GET_ADVANCES, etc.)
// mirroring the main invoice helpers but scoped to repair transactions.

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';
import APP_CONFIG from '@/constants/appConfig';

// ─── REPAIR ORDER (the workshop job the intake is raised against) ─────────────
//
// Confirmed 2026-08-01 off real posted UAT records (see [[repair-flow-contract]]).
//
// A Repair In line item is NOT free-typed — it is COPIED from a Repair Order
// line and points back at it. Real record: Repair In REPI-06-26-027 line
// carries ref_document_id 75, ref_transaction_id 122, ref_transaction_item_id
// 146, i.e. the line of order FCS-REP-06-26-2.
//
// Repair Order lines are ~188-key objects; the Repair In line is a ~47-key
// subset. mapOrderLineToRepairInLine() below performs exactly that projection,
// copying only fields observed on a real Repair In line — nothing invented.

/** document_id of the workshop Repair Order. */
const REPAIR_ORDER_DOCUMENT_ID = 75;

/**
 * Repair orders available to raise an intake against.
 * @param {{ partyId?: number, take?: number, company_id?: number }} params
 * @returns {Promise<object[]>}
 */
export async function getRepairOrders({ partyId, take = 50, company_id } = {}) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_ORDER_LIST, {
    Take: take,
    party_id: partyId ?? undefined,
    company_id: company_id ?? undefined,
  });
  return response.data?.Entities ?? [];
}

/**
 * Full repair order including its line_items — the source for an intake.
 * @param {number} transactionId
 */
export async function getRepairOrderDetail(transactionId) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_ORDER_RETRIEVE, {
    EntityId: transactionId,
  });
  return response.data?.Entity ?? null;
}

// Fields observed on a real Repair In line item (REPI-06-26-027, txn 39).
// Copied verbatim from the Repair Order line; anything not in this list is
// either server-assigned or absent from the intake.
const REPAIR_IN_LINE_FIELDS = [
  'item_id', 'item_attribute_id', 'item_line_no', 'item_code', 'item_name',
  'sku', 'huid', 'certificate_no', 'bag_no', 'new_bag_no',
  'pieces', 'weight', 'net_weight', 'pure_weight', 'purity',
  'diamond_pieces', 'diamond_weight',
  'parts', 'is_bom', 'location_id',
  'sales_costing_id', 'purchase_costing_id',
  'supplier_batch', 'supplier_style',
];

/**
 * Projects a Repair Order line into the Repair In line the server expects,
 * carrying the back-references that tie the intake to its order.
 *
 * @param {object} orderLine — a line_items[] entry from getRepairOrderDetail()
 * @param {object} order     — the parent order entity
 */
export function mapOrderLineToRepairInLine(orderLine, order) {
  const line = {};
  for (const field of REPAIR_IN_LINE_FIELDS) {
    if (orderLine[field] !== undefined) line[field] = orderLine[field];
  }
  // bag_no on the intake mirrors the order's new_bag_no when present.
  if (line.bag_no == null && orderLine.new_bag_no) line.bag_no = orderLine.new_bag_no;

  return {
    ...line,
    document_id: APP_CONFIG.DOCUMENT_TYPES.REPAIR_IN,
    party_id:    order.party_id,
    company_id:  order.company_id,
    financial_year_id: order.financial_year_id,
    // ← what makes this an intake AGAINST that order
    ref_document_id:         REPAIR_ORDER_DOCUMENT_ID,
    ref_transaction_id:      order.transaction_id,
    ref_transaction_item_id: orderLine.transaction_item_id,
  };
}

/**
 * Convenience: order + its lines, already projected for a Repair In.
 * @param {number} transactionId
 */
export async function getRepairOrderAsIntakeLines(transactionId) {
  const order = await getRepairOrderDetail(transactionId);
  if (!order) return { order: null, lines: [] };
  const lines = (order.line_items ?? []).map((l) => mapOrderLineToRepairInLine(l, order));
  return { order, lines };
}

// ─── REPAIR IN (Intake) ───────────────────────────────────────────────────────

/**
 * Paginated list of repair intake records.
 * @param {{ take?: number, skip?: number, company_id?: number }} params
 * @returns {Promise<object>} { Entities[], TotalCount }
 */
export async function getRepairIns({ take = 50, skip = 0, company_id } = {}) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_IN_LIST, {
    Take:       take,
    Skip:       skip,
    company_id: company_id ?? undefined,
  });
  return response.data;
}

/**
 * Full detail of a single repair intake.
 * @param {number} transactionId
 * @returns {Promise<object>} { Entity: RepairInRow }
 */
export async function getRepairInDetail(transactionId) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_IN_RETRIEVE, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Create a repair intake (customer drops item).
 * @param {object} repairInEntity — RepairInRow fields
 *   Required: party_id, company_id, document_date, line_items[]
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function createRepairIn(repairInEntity) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_IN_CREATE, {
    Entity: repairInEntity,
  });
  return response.data;
}

/**
 * Post (finalise) a repair intake.
 * @param {number} transactionId
 * @returns {Promise<object>} PostResponse
 */
export async function postRepairIn(transactionId) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_IN_POST, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Cancel a repair intake.
 * @param {number} transactionId
 * @returns {Promise<object>} OrnaVerse response
 */
export async function cancelRepairIn(transactionId) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_IN_CANCEL, {
    EntityId: transactionId,
  });
  return response.data;
}

// ─── REPAIR OUT (To craftsman) ────────────────────────────────────────────────

/**
 * Paginated list of repair-out records.
 * @param {{ take?: number, skip?: number, company_id?: number }} params
 * @returns {Promise<object>} { Entities[], TotalCount }
 */
export async function getRepairOuts({ take = 50, skip = 0, company_id } = {}) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_OUT_LIST, {
    Take:       take,
    Skip:       skip,
    company_id: company_id ?? undefined,
  });
  return response.data;
}

/**
 * Create a repair-out (send item to craftsman).
 * @param {object} repairOutEntity — RepairOutRow fields
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function createRepairOut(repairOutEntity) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_OUT_CREATE, {
    Entity: repairOutEntity,
  });
  return response.data;
}

/**
 * Post (finalise) a repair-out.
 * @param {number} transactionId
 * @returns {Promise<object>} PostResponse
 */
export async function postRepairOut(transactionId) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_OUT_POST, {
    EntityId: transactionId,
  });
  return response.data;
}

// ─── REPAIR INVOICE (Return to customer + billing) ────────────────────────────

/**
 * Paginated list of repair invoices.
 * @param {{ take?: number, skip?: number, company_id?: number }} params
 * @returns {Promise<object>} { Entities[], TotalCount }
 */
export async function getRepairInvoices({ take = 50, skip = 0, company_id } = {}) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_INVOICE_LIST, {
    Take:       take,
    Skip:       skip,
    company_id: company_id ?? undefined,
  });
  return response.data;
}

/**
 * Full detail of a single repair invoice.
 * @param {number} transactionId
 * @returns {Promise<object>} { Entity: RepairInvoiceRow }
 */
export async function getRepairInvoiceDetail(transactionId) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_INVOICE_RETRIEVE, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Create a repair invoice (item ready, bill the customer).
 * @param {object} repairInvoiceEntity — RepairInvoiceRow fields
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function createRepairInvoice(repairInvoiceEntity) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_INVOICE_CREATE, {
    Entity: repairInvoiceEntity,
  });
  return response.data;
}

/**
 * Post (finalise) a repair invoice.
 * @param {number} transactionId
 * @returns {Promise<object>} PostResponse
 */
export async function postRepairInvoice(transactionId) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_INVOICE_POST, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Create a payment receipt against a repair invoice.
 * @param {object} receiptEntity — RepairInvoiceReceiptRow fields
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function createRepairInvoiceReceipt(receiptEntity) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_INVOICE_RECEIPT, {
    Entity: receiptEntity,
  });
  return response.data;
}

// ─── REPAIR INVOICE HELPERS (available balances at billing) ───────────────────

/**
 * Get customer's advance payments available for repair invoice.
 * @param {{ party_id: number, company_id: number }} params
 */
export async function getRepairInvoiceAdvances({ party_id, company_id }) {
  const response = await axiosInstance.post(
    API.REPAIR.REPAIR_INVOICE_HELPERS_GET_ADVANCES,
    { party_id, company_id }
  );
  return response.data;
}

/**
 * Get customer's scheme balance available for repair invoice.
 * @param {{ party_id: number, company_id: number }} params
 */
export async function getRepairInvoiceScheme({ party_id, company_id }) {
  const response = await axiosInstance.post(
    API.REPAIR.REPAIR_INVOICE_HELPERS_GET_SCHEME,
    { party_id, company_id }
  );
  return response.data;
}

/**
 * Get customer's credit note balance available for repair invoice.
 * @param {{ party_id: number, company_id: number }} params
 */
export async function getRepairInvoiceCreditNote({ party_id, company_id }) {
  const response = await axiosInstance.post(
    API.REPAIR.REPAIR_INVOICE_HELPERS_GET_CREDIT,
    { party_id, company_id }
  );
  return response.data;
}

/**
 * Get customer's exchange value available for repair invoice.
 * @param {{ party_id: number, company_id: number }} params
 */
export async function getRepairInvoiceExchange({ party_id, company_id }) {
  const response = await axiosInstance.post(
    API.REPAIR.REPAIR_INVOICE_HELPERS_GET_EXCHANGE,
    { party_id, company_id }
  );
  return response.data;
}