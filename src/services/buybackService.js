// src/services/buybackService.js
// POS Buy Back — store purchases old jewellery outright from customer.
// All functions are pure HTTP wrappers — no business logic.
//
// FLOW: createBuyback() → postBuyback()
//
// Difference from Exchange:
//   Exchange  = old item + cash differential → new item
//   Buy Back  = old item → cash paid to customer (no new purchase required)
//
// Difference from URD Purchase:
//   Buy Back    = buying finished jewellery from a retail customer
//   URD Purchase = buying raw gold from an unregistered dealer

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

/**
 * Paginated list of POS buy back transactions.
 * @param {{ take?: number, skip?: number, company_id?: number }} params
 * @returns {Promise<object>} { Entities[], TotalCount }
 */
export async function getBuybacks({ take = 50, skip = 0, company_id } = {}) {
  const response = await axiosInstance.post(API.BUYBACK.LIST, {
    Take:       take,
    Skip:       skip,
    company_id: company_id ?? undefined,
  });
  return response.data;
}

/**
 * Full detail of a single buy back transaction.
 * @param {number} transactionId
 * @returns {Promise<object>} { Entity: BuyBackRow }
 */
export async function getBuybackDetail(transactionId) {
  const response = await axiosInstance.post(API.BUYBACK.RETRIEVE, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Create a draft buy back transaction.
 * @param {object} buybackEntity — BuyBackRow fields
 *   Required: party_id, company_id, document_date, line_items[]
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function createBuyback(buybackEntity) {
  const response = await axiosInstance.post(API.BUYBACK.CREATE, {
    Entity: buybackEntity,
  });
  return response.data;
}

/**
 * Post (finalise) a draft buy back.
 * @param {number} transactionId — EntityId from createBuyback()
 * @returns {Promise<object>} PostResponse
 */
export async function postBuyback(transactionId) {
  const response = await axiosInstance.post(API.BUYBACK.POST, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Cancel a draft buy back before posting.
 * @param {number} transactionId
 * @returns {Promise<object>} OrnaVerse response
 */
export async function cancelBuyback(transactionId) {
  const response = await axiosInstance.post(API.BUYBACK.CANCEL, {
    EntityId: transactionId,
  });
  return response.data;
}