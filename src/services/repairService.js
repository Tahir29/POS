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