// src/services/urdPurchaseService.js
// URD Purchase — purchase of raw old gold from customer or unregistered dealer.
// All functions are pure HTTP wrappers — no business logic.
//
// URD = Unregistered Dealer
// Used when a customer sells raw gold/silver/metal (not finished jewellery)
// to the store. Triggers inward stock entry for raw material.
//
// FLOW: createURDPurchase() → postURDPurchase()

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

/**
 * Paginated list of URD purchase transactions.
 * @param {{ take?: number, skip?: number, company_id?: number }} params
 * @returns {Promise<object>} { Entities[], TotalCount }
 */
export async function getURDPurchases({ take = 50, skip = 0, company_id } = {}) {
  const response = await axiosInstance.post(API.URD_PURCHASE.LIST, {
    Take:       take,
    Skip:       skip,
    company_id: company_id ?? undefined,
  });
  return response.data;
}

/**
 * Full detail of a single URD purchase transaction.
 * @param {number} transactionId
 * @returns {Promise<object>} { Entity: URDPurchaseRow }
 */
export async function getURDPurchaseDetail(transactionId) {
  const response = await axiosInstance.post(API.URD_PURCHASE.RETRIEVE, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Create a draft URD purchase.
 * @param {object} urdEntity — URDPurchaseRow fields
 *   Required: party_id, company_id, document_date,
 *             line_items[] (metal_type_id, weight, rate, amount)
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function createURDPurchase(urdEntity) {
  const response = await axiosInstance.post(API.URD_PURCHASE.CREATE, {
    Entity: urdEntity,
  });
  return response.data;
}

/**
 * Post (finalise) a draft URD purchase.
 * Triggers raw material stock inward and payment out to customer.
 * @param {number} transactionId — EntityId from createURDPurchase()
 * @returns {Promise<object>} PostResponse
 */
export async function postURDPurchase(transactionId) {
  const response = await axiosInstance.post(API.URD_PURCHASE.POST, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Cancel a draft URD purchase before posting.
 * @param {number} transactionId
 * @returns {Promise<object>} OrnaVerse response
 */
export async function cancelURDPurchase(transactionId) {
  const response = await axiosInstance.post(API.URD_PURCHASE.CANCEL, {
    EntityId: transactionId,
  });
  return response.data;
}