// src/services/returnService.js
// POS Returns — customer returns items from a previous invoice.
// All functions are pure HTTP wrappers — no business logic.
//
// FLOW: createReturn() → postReturn()
// Cancel only before posting.
//
// Payload (ReturnRow) key fields:
//   party_id, company_id, document_date, currency_id
//   ref_transaction_id  — the original invoice transaction_id being returned
//   line_items[]        — ReturnItemsRow (item_id, pieces, item_rate, net_amount)
//   receipt_details[]   — how refund is paid back (mode_id, amount)

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

/**
 * Paginated list of POS returns.
 * @param {{ take?: number, skip?: number, company_id?: number }} params
 * @returns {Promise<object>} { Entities[], TotalCount }
 */
export async function getReturns({ take = 50, skip = 0, company_id } = {}) {
  const response = await axiosInstance.post(API.RETURNS.LIST, {
    Take:       take,
    Skip:       skip,
    company_id: company_id ?? undefined,
  });
  return response.data;
}

/**
 * Full detail of a single return.
 * @param {number} transactionId
 * @returns {Promise<object>} { Entity: ReturnRow }
 */
export async function getReturnDetail(transactionId) {
  const response = await axiosInstance.post(API.RETURNS.RETRIEVE, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Create a draft return.
 * @param {object} returnEntity — ReturnRow fields
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function createReturn(returnEntity) {
  const response = await axiosInstance.post(API.RETURNS.CREATE, {
    Entity: returnEntity,
  });
  return response.data;
}

/**
 * Post (finalise) a draft return.
 * Triggers stock credit and refund accounting.
 * @param {number} transactionId — EntityId from createReturn()
 * @returns {Promise<object>} PostResponse
 */
export async function postReturn(transactionId) {
  const response = await axiosInstance.post(API.RETURNS.POST, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Cancel a draft return before posting.
 * @param {number} transactionId
 * @returns {Promise<object>} OrnaVerse response
 */
export async function cancelReturn(transactionId) {
  const response = await axiosInstance.post(API.RETURNS.CANCEL, {
    EntityId: transactionId,
  });
  return response.data;
}