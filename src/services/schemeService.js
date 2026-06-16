import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

/**
 * Fetches scheme enrollment records.
 * Maps to: POST Services/POS/SchemeEnrollment/List
 *
 * Response shape unconfirmed — expected to follow the OrnaVerse
 * Entities[]/TotalCount convention used by other /List endpoints
 * (see useCustomerEnrollments.js for normalization + fallbacks).
 *
 * @param {{ take?: number }} [params]
 * @returns {Promise<object>} OrnaVerse response
 */
export async function getSchemeEnrollments({ take = 0 } = {}) {
  const response = await axiosInstance.post(API.SCHEMES.ENROLLMENTS_LIST, {
    Take: take,
  });
  return response.data;
}