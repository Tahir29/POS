import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

/**
 * Fetches a paginated list of POS orders.
 * Maps to: POST Services/POS/Order/List
 * Additional order service functions (getOrderDetail, getInvoices, etc.)
 * will be added in Phase 13.
 * @param {{ take?: number, skip?: number }} params - Pagination parameters.
 * @returns {Promise<object>} OrnaVerse response containing orders array.
 */
export async function getOrders({ take = 50, skip = 0 } = {}) {
  const response = await axiosInstance.post(API.ORDERS.LIST, {
    Take: take,
    Skip: skip,
  });
  return response.data;
}

/**
 * Submits a new order to OrnaVerse.
 * Maps to: POST Services/MarketPlace/Order/Generate
 *
 * NOTE: `channel` (POS_CHANNEL_ID) is currently null in appConfig.js and
 * must be confirmed with the OrnaVerse integration team before this can
 * be used against a real order. useCreateOrder will throw if it is null.
 *
 * @param {object} orderPayload - Full order payload per API_MAPPING.md Section 11.3
 * @returns {Promise<object>} OrnaVerse response (order_id, invoice_id, status)
 */
export async function createOrder(orderPayload) {
  const response = await axiosInstance.post(API.MARKETPLACE.CREATE_ORDER, orderPayload);
  return response.data;
}

/**
 * Retrieves complete detail of a single invoice by its entity ID.
 * Maps to: POST Services/POS/Invoice/Retrieve
 * @param {number} invoiceId - The invoice entity ID
 * @returns {Promise<object>} OrnaVerse response containing the invoice Entity
 */
export async function getInvoiceDetail(invoiceId) {
  const response = await axiosInstance.post(API.ORDERS.INVOICE_DETAIL, {
    EntityId: invoiceId,
  });
  return response.data;
}

/**
 * Fetches a paginated list of POS invoices.
 * Maps to: POST Services/POS/Invoice/List
 * @param {{ take?: number, skip?: number }} params - Pagination parameters.
 * @returns {Promise<object>} OrnaVerse response containing Entities[] and TotalCount.
 */
export async function getInvoiceList({ take = 100, skip = 0 } = {}) {
  const response = await axiosInstance.post(API.ORDERS.INVOICE_LIST, {
    Take: take,
    Skip: skip,
  });
  return response.data;
}

/**
 * Retrieves complete detail of a single POS order by its entity ID.
 * Maps to: POST Services/POS/Order/Retrieve
 * @param {number} orderId - The POS order entity ID (transaction_id from Order/List)
 * @returns {Promise<object>} OrnaVerse response containing the order Entity
 */
export async function getOrderDetail(orderId) {
  const response = await axiosInstance.post(API.ORDERS.RETRIEVE, {
    EntityId: orderId,
  });
  return response.data;
}