// src/services/promotionService.js
// Promo code validation — Phase 9b (Checkout).
// All calls use axiosInstance; interceptors handle auth.
// Source of truth: API_MAPPING.md Section 12

import axiosInstance from "@/lib/axios/axiosInstance";
import API from "@/constants/apiEndpoints";

/**
 * Validate a promo code and retrieve its discount rules.
 * @param {string} promoCode
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function getPromotion(promoCode) {
    return axiosInstance.post(API.CRM.GET_PROMOTION, {promo_code: promoCode});
}