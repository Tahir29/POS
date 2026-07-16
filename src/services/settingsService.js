// src/services/settingsService.js
// Settings, payment modes, taxes, metal rates, reason codes.
// All functions are pure HTTP wrappers — no business logic.
//
// NOTE: AppSettings/Retrieve and AppSettings/Update are NOT present
// in the v1.json spec — those endpoints no longer exist. Removed.

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

// ─── PAYMENT MODES ────────────────────────────────────────────────────────────

/**
 * All payment receipt modes available for a sale (Cash, Card, UPI, etc.).
 * Filtered client-side by ALLOWLIST/DENYLIST in appConfig.js.
 * @returns {Promise<object>} Entities[] of PaymentReceiptModeRow
 */
export async function getPaymentModes() {
  const response = await axiosInstance.post(API.SETTINGS.GET_PAYMENT_MODES, {
    Take: 0,
  });
  return response.data;
}

/**
 * Payment modes available specifically for refund transactions.
 * Subset of getPaymentModes() — use this on the refund screen.
 * @returns {Promise<object>} Entities[] of PaymentReceiptModeRow
 */
export async function getPaymentModesForRefund() {
  const response = await axiosInstance.post(API.SETTINGS.GET_PAYMENT_MODES_REFUND, {
    Take: 0,
  });
  return response.data;
}

// ─── TAXES ────────────────────────────────────────────────────────────────────

/**
 * Fetches applicable taxes for the store (GST slabs, etc.).
 * Used to display tax breakdown on invoices.
 * @param {{ company_id: number }} params
 * @returns {Promise<object>} OrnaVerse tax response
 */
export async function getTaxes({ company_id } = {}) {
  const response = await axiosInstance.post(API.SETTINGS.GET_TAXES, {
    company_id,
  });
  return response.data;
}

// ─── METAL RATE UTILITIES ────────────────────────────────────────────────────

/**
 * Check whether a metal rate has been entered for today.
 * Call at POS startup — warn the operator if rates are missing.
 * @returns {Promise<object>} OrnaVerse response with rate status
 */
export async function checkMetalRateToday() {
  const response = await axiosInstance.post(API.SETTINGS.CHECK_METAL_RATE_TODAY, {});
  return response.data;
}

/**
 * Creates a new metal rate entry for the day.
 * @param {{
 *   metal_type_id: number,
 *   purchase_rate:  number,
 *   sales_rate:     number,
 *   from_date:      string,
 *   currency_id:    number
 * }} payload
 * @returns {Promise<object>} SaveResponse { EntityId, Error }
 */
export async function addMetalRate(payload) {
  const response = await axiosInstance.post(API.COSTING.ADD_METAL_RATE, payload);
  return response.data;
}

/**
 * Fetches current metal rate for a specific metal type.
 * @param {{ metal_type_id: number, company_id?: number }} params
 * @returns {Promise<object>} OrnaVerse rate response
 */
export async function getMetalRate({ metal_type_id, company_id } = {}) {
  const response = await axiosInstance.post(API.COSTING.GET_METAL_RATE, {
    metal_type_id,
    company_id,
  });
  return response.data;
}

/**
 * Fetches all current metal + stone + labour rates in one call.
 * Use on the Settings page to display current rate snapshot.
 * @param {{ company_id?: number }} params
 * @returns {Promise<object>} OrnaVerse all-rates response
 */
export async function getAllRates({ company_id } = {}) {
  const response = await axiosInstance.post(API.COSTING.GET_ALL_RATES, {
    company_id,
  });
  return response.data;
}

// ─── EXCHANGE RATE ────────────────────────────────────────────────────────────

/**
 * Currency exchange rate — required on Order/Invoice Create alongside
 * currency_id. Confirmed via direct UAT test 2026-07-16: currency_id 103
 * (INR) returns exchange_rate: 1.
 * @param {{ currency_id: number, company_id?: number }} params
 * @returns {Promise<object>} { Entity: { exchange_rate, currency_id, ... } }
 */
export async function getExchangeRate({ currency_id, company_id } = {}) {
  const response = await axiosInstance.post(API.EXCHANGE_RATE.GET, {
    currency_id,
    company_id,
  });
  return response.data;
}

// ─── REASON CODES ─────────────────────────────────────────────────────────────

/**
 * Fetches reason codes used for returns, cancellations, exchanges.
 * Static dataset — cache for session.
 * @returns {Promise<object>} Entities[] of ReasonRow
 */
export async function getReasonCodes() {
  const response = await axiosInstance.post(API.SETTINGS.GET_REASON_CODES, {
    Take: 0,
  });
  return response.data;
}