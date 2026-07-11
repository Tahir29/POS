// src/services/transactionService.js
//
// Pure HTTP wrappers for all POS transaction types:
//   Returns, Refunds, Credit Notes, Exchange, Buyback, URD Purchase
//
// FLOW for Returns / Credit Notes / Exchange / Buyback / URD Purchase:
//   Create → Post  (two-step commit, same as Invoice/Order)
//   Cancel  — voids a created-but-not-posted transaction
//   Retrieve — single record by EntityId
//   List     — paginated list
//
// FLOW for Refunds (different — three endpoints, no Post step):
//   Create → AddDetail → AddReceipt
//   Delete  — voids the refund
//   Retrieve / List as normal
//
// All functions return response.data (unwrapped from Axios response).
// Hooks are responsible for reading .Entities / .Entity / .EntityId.
//
// SCHEMA NOTES:
//   - All list responses: { Entities[], TotalCount }
//   - All retrieve responses: { Entity }
//   - All create/post responses: { EntityId } (the new transaction_id)
//   - company_id must be passed for every list/create call (matches Order/Invoice convention;
//     NOT current_company_id, which is the Inventory/ProductCatalog-specific field name)

import axiosInstance from '@/lib/axios/axiosInstance';
import API           from '@/constants/apiEndpoints';

// ─── RETURNS ──────────────────────────────────────────────────────────────────

/**
 * Paginated list of return transactions.
 * @param {{ company_id: number, take?: number, skip?: number }} params
 */
export async function getReturns({ company_id, take = 50, skip = 0 } = {}) {
  const response = await axiosInstance.post(API.RETURNS.LIST, {
    company_id: company_id ?? undefined,
    Take: take,
    Skip: skip,
  });
  return response.data;
}

/**
 * Single return by transaction_id.
 * @param {number} transactionId
 */
export async function getReturnDetail(transactionId) {
  const response = await axiosInstance.post(API.RETURNS.RETRIEVE, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Create a return draft (step 1 of 2).
 * @param {object} payload — full return Entity object
 */
export async function createReturn(payload) {
  const response = await axiosInstance.post(API.RETURNS.CREATE, {
    Entity: payload,
  });
  return response.data;
}

/**
 * Post (commit) a return draft (step 2 of 2).
 * @param {number} transactionId — EntityId from createReturn
 */
export async function postReturn(transactionId) {
  const response = await axiosInstance.post(API.RETURNS.POST, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Cancel a return (before Post).
 * @param {number} transactionId
 */
export async function cancelReturn(transactionId) {
  const response = await axiosInstance.post(API.RETURNS.CANCEL, {
    EntityId: transactionId,
  });
  return response.data;
}

// ─── REFUNDS ──────────────────────────────────────────────────────────────────

/**
 * Paginated list of refund transactions.
 * @param {{ company_id: number, take?: number, skip?: number }} params
 */
export async function getRefunds({ company_id, take = 50, skip = 0 } = {}) {
  const response = await axiosInstance.post(API.REFUNDS.LIST, {
    company_id: company_id ?? undefined,
    Take: take,
    Skip: skip,
  });
  return response.data;
}

/**
 * Single refund by transaction_id.
 * @param {number} transactionId
 */
export async function getRefundDetail(transactionId) {
  const response = await axiosInstance.post(API.REFUNDS.RETRIEVE, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Create a refund header (step 1 of 3).
 * @param {object} payload
 */
export async function createRefund(payload) {
  const response = await axiosInstance.post(API.REFUNDS.CREATE, {
    Entity: payload,
  });
  return response.data;
}

/**
 * Add line-item detail to a refund (step 2 of 3).
 * @param {object} payload — refund detail row
 */
export async function addRefundDetail(payload) {
  const response = await axiosInstance.post(API.REFUNDS.ADD_DETAIL, {
    Entity: payload,
  });
  return response.data;
}

/**
 * Add payment receipt to a refund (step 3 of 3 — commits the refund).
 * @param {object} payload — refund receipt row
 */
export async function addRefundReceipt(payload) {
  const response = await axiosInstance.post(API.REFUNDS.ADD_RECEIPT, {
    Entity: payload,
  });
  return response.data;
}

/**
 * Delete (void) a refund.
 * @param {number} transactionId
 */
export async function deleteRefund(transactionId) {
  const response = await axiosInstance.post(API.REFUNDS.DELETE, {
    EntityId: transactionId,
  });
  return response.data;
}

// ─── CREDIT NOTES ─────────────────────────────────────────────────────────────

/**
 * Paginated list of credit note transactions.
 * @param {{ company_id: number, take?: number, skip?: number }} params
 */
export async function getCreditNotes({ company_id, take = 50, skip = 0 } = {}) {
  const response = await axiosInstance.post(API.CREDIT_NOTES.LIST, {
    company_id: company_id ?? undefined,
    Take: take,
    Skip: skip,
  });
  return response.data;
}

/**
 * Single credit note by transaction_id.
 * @param {number} transactionId
 */
export async function getCreditNoteDetail(transactionId) {
  const response = await axiosInstance.post(API.CREDIT_NOTES.RETRIEVE, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Create a credit note draft (step 1 of 2).
 * @param {object} payload
 */
export async function createCreditNote(payload) {
  const response = await axiosInstance.post(API.CREDIT_NOTES.CREATE, {
    Entity: payload,
  });
  return response.data;
}

/**
 * Post (commit) a credit note (step 2 of 2).
 * @param {number} transactionId
 */
export async function postCreditNote(transactionId) {
  const response = await axiosInstance.post(API.CREDIT_NOTES.POST, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Cancel a credit note (before Post).
 * @param {number} transactionId
 */
export async function cancelCreditNote(transactionId) {
  const response = await axiosInstance.post(API.CREDIT_NOTES.CANCEL, {
    EntityId: transactionId,
  });
  return response.data;
}

// ─── EXCHANGE ─────────────────────────────────────────────────────────────────

/**
 * Paginated list of exchange transactions.
 * @param {{ company_id: number, take?: number, skip?: number }} params
 */
export async function getExchanges({ company_id, take = 50, skip = 0 } = {}) {
  const response = await axiosInstance.post(API.EXCHANGE.LIST, {
    company_id: company_id ?? undefined,
    Take: take,
    Skip: skip,
  });
  return response.data;
}

/**
 * Single exchange by transaction_id.
 * @param {number} transactionId
 */
export async function getExchangeDetail(transactionId) {
  const response = await axiosInstance.post(API.EXCHANGE.RETRIEVE, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Create an exchange draft (step 1 of 2).
 * @param {object} payload
 */
export async function createExchange(payload) {
  const response = await axiosInstance.post(API.EXCHANGE.CREATE, {
    Entity: payload,
  });
  return response.data;
}

/**
 * Post (commit) an exchange (step 2 of 2).
 * @param {number} transactionId
 */
export async function postExchange(transactionId) {
  const response = await axiosInstance.post(API.EXCHANGE.POST, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Cancel an exchange (before Post).
 * @param {number} transactionId
 */
export async function cancelExchange(transactionId) {
  const response = await axiosInstance.post(API.EXCHANGE.CANCEL, {
    EntityId: transactionId,
  });
  return response.data;
}

// ─── BUYBACK ──────────────────────────────────────────────────────────────────

/**
 * Paginated list of buyback transactions.
 * @param {{ company_id: number, take?: number, skip?: number }} params
 */
export async function getBuybacks({ company_id, take = 50, skip = 0 } = {}) {
  const response = await axiosInstance.post(API.BUYBACK.LIST, {
    company_id: company_id ?? undefined,
    Take: take,
    Skip: skip,
  });
  return response.data;
}

/**
 * Single buyback by transaction_id.
 * @param {number} transactionId
 */
export async function getBuybackDetail(transactionId) {
  const response = await axiosInstance.post(API.BUYBACK.RETRIEVE, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Create a buyback draft (step 1 of 2).
 * @param {object} payload
 */
export async function createBuyback(payload) {
  const response = await axiosInstance.post(API.BUYBACK.CREATE, {
    Entity: payload,
  });
  return response.data;
}

/**
 * Post (commit) a buyback (step 2 of 2).
 * @param {number} transactionId
 */
export async function postBuyback(transactionId) {
  const response = await axiosInstance.post(API.BUYBACK.POST, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Cancel a buyback (before Post).
 * @param {number} transactionId
 */
export async function cancelBuyback(transactionId) {
  const response = await axiosInstance.post(API.BUYBACK.CANCEL, {
    EntityId: transactionId,
  });
  return response.data;
}

// ─── URD PURCHASE ─────────────────────────────────────────────────────────────

/**
 * Paginated list of URD purchase transactions.
 * @param {{ company_id: number, take?: number, skip?: number }} params
 */
export async function getURDPurchases({ company_id, take = 50, skip = 0 } = {}) {
  const response = await axiosInstance.post(API.URD_PURCHASE.LIST, {
    company_id: company_id ?? undefined,
    Take: take,
    Skip: skip,
  });
  return response.data;
}

/**
 * Single URD purchase by transaction_id.
 * @param {number} transactionId
 */
export async function getURDPurchaseDetail(transactionId) {
  const response = await axiosInstance.post(API.URD_PURCHASE.RETRIEVE, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Create a URD purchase draft (step 1 of 2).
 * @param {object} payload
 */
export async function createURDPurchase(payload) {
  const response = await axiosInstance.post(API.URD_PURCHASE.CREATE, {
    Entity: payload,
  });
  return response.data;
}

/**
 * Post (commit) a URD purchase (step 2 of 2).
 * @param {number} transactionId
 */
export async function postURDPurchase(transactionId) {
  const response = await axiosInstance.post(API.URD_PURCHASE.POST, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Cancel a URD purchase (before Post).
 * @param {number} transactionId
 */
export async function cancelURDPurchase(transactionId) {
  const response = await axiosInstance.post(API.URD_PURCHASE.CANCEL, {
    EntityId: transactionId,
  });
  return response.data;
}
