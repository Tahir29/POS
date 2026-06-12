// src/services/customerService.js
// Customer lookup and creation — Phase 9a (Customer Session).
// All calls use axiosInstance; interceptors handle auth.
// Source of truth: API_MAPPING.md Section 9

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

/**
 * Look up a customer by mobile number.
 * @param {string} mobile - 10-digit mobile number, digits only
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function getCustomer(mobile) {
  return axiosInstance.post(API.CUSTOMERS.GET_CUSTOMER, { mobile });
}

/**
 * Create a new customer record.
 * @param {object} payload - matches API_MAPPING.md Section 9.2 request body
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function createCustomer(payload) {
  return axiosInstance.post(API.CUSTOMERS.CREATE_CUSTOMER, payload);
}