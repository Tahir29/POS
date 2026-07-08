// src/services/refundService.js
// POS Refunds — cash/payment refund to customer.
// All functions are pure HTTP wrappers — no business logic.
//
// FLOW: createRefund() → add line items via addRefundDetail()
//       → add payment modes via addRefundReceipt() → done (no Post step)
//
// Separate from Returns:
//   Return = items come back to store
//   Refund = money goes back to customer (may be standalone or after a return)

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

/**
 * Paginated list of POS refunds.
 * @param {{ take?: number, skip?: number, company_id?: number }} params
 * @returns {Promise<object>} { Entities[], TotalCount }
 */
export async function getRefunds({ take = 50, skip = 0, company_id } = {}) {
  const response = await axiosInstance.post(API.REFUNDS.LIST, {
    Take:       take,
    Skip:       skip,
    company_id: company_id ?? undefined,
  });
  return response.data;
}

/**
 * Full detail of a single refund.
 * @param {number} refundId
 * @returns {Promise<object>} { Entity: RefundRow }
 */
export async function getRefundDetail(refundId) {
  const response = await axiosInstance.post(API.REFUNDS.RETRIEVE, {
    EntityId: refundId,
  });
  return response.data;
}

/**
 * Create a refund record.
 * @param {object} refundEntity — RefundRow fields
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function createRefund(refundEntity) {
  const response = await axiosInstance.post(API.REFUNDS.CREATE, {
    Entity: refundEntity,
  });
  return response.data;
}

/**
 * Update an existing refund.
 * @param {number} refundId
 * @param {object} refundEntity
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function updateRefund(refundId, refundEntity) {
  const response = await axiosInstance.post(API.REFUNDS.UPDATE, {
    EntityId: refundId,
    Entity:   refundEntity,
  });
  return response.data;
}

/**
 * Delete a refund (before finalisation).
 * @param {number} refundId
 * @returns {Promise<object>} OrnaVerse response
 */
export async function deleteRefund(refundId) {
  const response = await axiosInstance.post(API.REFUNDS.DELETE, {
    EntityId: refundId,
  });
  return response.data;
}

/**
 * Add a line item detail to a refund.
 * @param {object} detailEntity — RefundDetailsRow fields
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function addRefundDetail(detailEntity) {
  const response = await axiosInstance.post(API.REFUNDS.ADD_DETAIL, {
    Entity: detailEntity,
  });
  return response.data;
}

/**
 * Add a payment/receipt mode to a refund (how customer receives money back).
 * @param {object} receiptEntity — RefundReceiptsRow { refund_id, mode_id, amount }
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function addRefundReceipt(receiptEntity) {
  const response = await axiosInstance.post(API.REFUNDS.ADD_RECEIPT, {
    Entity: receiptEntity,
  });
  return response.data;
}