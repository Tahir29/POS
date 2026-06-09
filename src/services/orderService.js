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
