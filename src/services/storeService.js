import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

/**
 * Retrieves all store locations accessible to the authenticated user.
 * Called immediately after login to establish store context.
 * @returns {Promise<Array>} Array of store objects from OrnaVerse
 */
export async function getUserStores() {
  const response = await axiosInstance.post(API.STORES.GET_USER_STORES, {});

  return response.data;
}