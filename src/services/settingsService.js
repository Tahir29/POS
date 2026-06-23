import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

/**
 * Retrieves application-wide configuration settings from OrnaVerse.
 * Fetched once on application load after authentication.
 * @returns {Promise<Object>} Application settings object
 */
export async function getSettings() {
  const response = await axiosInstance.post(API.SETTINGS.GET_SETTINGS, {
    EntityId: 1,
  });

  return response.data;
}

/**
 * Updates application-wide configuration settings in OrnaVerse.
 * Admin-only operation.
 * @param {Object} settingsData - Settings fields to update
 * @returns {Promise<Object>} Updated settings confirmation
 */
export async function updateSettings(settingsData) {
  const response = await axiosInstance.post(API.SETTINGS.UPDATE_SETTINGS, settingsData);

  return response.data;
}

/**
 * Retrieves all available payment receipt modes (e.g. Cash, Card, UPI).
 * Used in the checkout screen to present payment options. No payment
 * modes are hardcoded.
 * @returns {Promise<Object>} OrnaVerse response containing Entities array
 */
export async function getPaymentModes() {
  const response = await axiosInstance.post(API.SETTINGS.GET_PAYMENT_MODES, {
    Take: 0,
  });

  return response.data;
}

/**
 * Creates a new metal rate entry.
 * Maps to: POST Services/Costing/MetalRates/Create
 * @param {{ metal_type_id: number, purchase_rate: number, sales_rate: number, from_date: string, currency_id: number }} payload
 * @returns {Promise<object>} OrnaVerse response
 */
export async function addMetalRate(payload) {
  const response = await axiosInstance.post(API.COSTING.ADD_METAL_RATE, payload);
  return response.data;
}