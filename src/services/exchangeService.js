// src/services/exchangeService.js
// POS Exchange — customer brings old jewellery, receives new piece.
// All functions are pure HTTP wrappers — no business logic.
//
// FLOW: createExchange() → postExchange()
//
// Exchange value appears in INVOICE_HELPERS.GET_EXCHANGE when customer
// is at checkout — applied as a payment mode against the new invoice.
// The exchange item is valued and that amount offsets the new purchase.

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

/**
 * Paginated list of POS exchanges.
 * @param {{ take?: number, skip?: number, company_id?: number }} params
 * @returns {Promise<object>} { Entities[], TotalCount }
 */
export async function getExchanges({ take = 50, skip = 0, company_id } = {}) {
  const response = await axiosInstance.post(API.EXCHANGE.LIST, {
    Take:       take,
    Skip:       skip,
    company_id: company_id ?? undefined,
  });
  return response.data;
}

/**
 * Full detail of a single exchange transaction.
 * @param {number} transactionId
 * @returns {Promise<object>} { Entity: ExchangeRow }
 */
export async function getExchangeDetail(transactionId) {
  const response = await axiosInstance.post(API.EXCHANGE.RETRIEVE, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Create a draft exchange transaction.
 * @param {object} exchangeEntity — ExchangeRow fields
 *   Required: party_id, company_id, document_date, line_items[]
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function createExchange(exchangeEntity) {
  const response = await axiosInstance.post(API.EXCHANGE.CREATE, {
    Entity: exchangeEntity,
  });
  return response.data;
}

/**
 * Post (finalise) a draft exchange.
 * @param {number} transactionId — EntityId from createExchange()
 * @returns {Promise<object>} PostResponse
 */
export async function postExchange(transactionId) {
  const response = await axiosInstance.post(API.EXCHANGE.POST, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Cancel a draft exchange before posting.
 * @param {number} transactionId
 * @returns {Promise<object>} OrnaVerse response
 */
export async function cancelExchange(transactionId) {
  const response = await axiosInstance.post(API.EXCHANGE.CANCEL, {
    EntityId: transactionId,
  });
  return response.data;
}