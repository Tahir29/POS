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
//
// ESTIMATION/CREATE 500S THE MOMENT A REAL LINE ITEM IS ADDED — confirmed
// live 2026-08-14 end to end against UAT (party_id 2221, Tahir Kutty),
// isolated with a real binary search, not a guess:
//   1. Header alone, line_items: [] → 200, real EntityId (18, then
//      cancelled to clean up the test).
//   2. Header + a hand-built 7-field line item (item_id/item_code/
//      item_name/pieces/item_rate/sub_total/taxable_amount/net_amount,
//      exactly what estimation/page.jsx currently sends) → 500 Exception.
//   3. Header + a FULL line item computed via Helpers/SetSalesItems with
//      document_id:52 (Estimation's own constant, confirmed already used
//      this way by pricingService.js) → STILL 500 Exception. Same result
//      with a real vs. a guessed ledger_id on the header, so it isn't that
//      either.
// So this isn't the usual "line item needs the full computed shape"
// problem that fixed Order/Return/Buyback/Exchange — something about
// Estimation's line-item processing itself is broken server-side on this
// tenant. The earlier "Estimation's full lifecycle is genuinely solid"
// assessment was based on code review + a route sweep (render/console
// errors only), not an actual submit — this live test is the correction.
// Needs OrnaVerse's team; the UI now says so instead of implying success.

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