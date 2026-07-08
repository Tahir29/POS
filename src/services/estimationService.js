// src/services/estimationService.js
// POS Estimation / Quotation — price estimate before a purchase.
// All functions are pure HTTP wrappers — no business logic.
//
// FLOW:
//   createEstimation() → (optional updateEstimation()) → postEstimation()
//   postEstimation() converts the estimate into a posted order/invoice.
//   cancelEstimation() if customer declines.
//
// Use case: Customer asks "how much would this ring cost?" —
// staff creates an estimation, customer gets a quote slip,
// and if they agree, the estimation is posted to create the sale.

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

/**
 * Paginated list of estimations/quotations.
 * @param {{ take?: number, skip?: number, company_id?: number, party_id?: number }} params
 * @returns {Promise<object>} { Entities[], TotalCount }
 */
export async function getEstimations({ take = 50, skip = 0, company_id, party_id } = {}) {
  const response = await axiosInstance.post(API.ESTIMATION.LIST, {
    Take:       take,
    Skip:       skip,
    company_id: company_id ?? undefined,
    party_id:   party_id   ?? undefined,
  });
  return response.data;
}

/**
 * Full detail of a single estimation.
 * @param {number} transactionId
 * @returns {Promise<object>} { Entity: EstimationRow }
 */
export async function getEstimationDetail(transactionId) {
  const response = await axiosInstance.post(API.ESTIMATION.RETRIEVE, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Create a draft estimation/quotation.
 * @param {object} estimationEntity — EstimationRow fields
 *   Required: party_id, company_id, document_date, line_items[]
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function createEstimation(estimationEntity) {
  const response = await axiosInstance.post(API.ESTIMATION.CREATE, {
    Entity: estimationEntity,
  });
  return response.data;
}

/**
 * Update a draft estimation.
 * @param {number} transactionId
 * @param {object} estimationEntity — updated EstimationRow fields
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function updateEstimation(transactionId, estimationEntity) {
  const response = await axiosInstance.post(API.ESTIMATION.UPDATE, {
    EntityId: transactionId,
    Entity:   estimationEntity,
  });
  return response.data;
}

/**
 * Post (convert) an estimation to a sale/invoice.
 * @param {number} transactionId — EntityId from createEstimation()
 * @returns {Promise<object>} PostResponse
 */
export async function postEstimation(transactionId) {
  const response = await axiosInstance.post(API.ESTIMATION.POST, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Cancel an estimation (customer declined the quote).
 * @param {number} transactionId
 * @returns {Promise<object>} OrnaVerse response
 */
export async function cancelEstimation(transactionId) {
  const response = await axiosInstance.post(API.ESTIMATION.CANCEL, {
    EntityId: transactionId,
  });
  return response.data;
}