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

/**
 * Bank/POS accounts a bank-settled payment (Credit Card, Debit Card, UPI)
 * can be deposited against — e.g. "HDFC BANK MAIN", "ICICI BANK MAIN".
 * Do NOT pass company_id — confirmed live 2026-08-13 that this endpoint
 * 500s if you do; it's scoped server-side from the token.
 * @returns {Promise<object>} Entities[] of {id, code, name, ledger_id, company_id}
 */
export async function getBankPosAccounts() {
  const response = await axiosInstance.post(API.SETTINGS.GET_BANK_POS_ACCOUNTS, {
    Take: 0,
  });
  return response.data;
}

// ─── TAXES ────────────────────────────────────────────────────────────────────

/**
 * Fetches applicable taxes for the store (GST slabs, etc.).
 *
 * `exchange_rate` is REQUIRED — confirmed live 2026-08-14: omitting it
 * (this function's only caller before this fix, the new Settings screen,
 * is also the first real caller ever) returns
 * {"Code":"exchange_rate","Message":"Exchange rate must be greater than
 * zero."} before the request even reaches tax lookup. Even with it, a
 * store with no tax template configured returns {"Message":"Tax Template
 * Not Defined!"} — a real per-store config gap, not a bug here.
 * @param {{ company_id: number }} params
 * @returns {Promise<object>} OrnaVerse tax response
 */
export async function getTaxes({ company_id } = {}) {
  const response = await axiosInstance.post(API.SETTINGS.GET_TAXES, {
    company_id,
    exchange_rate: 1,
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
 *
 * CONFIRMED BROKEN live 2026-08-14 — Administration/Reason/List returns a
 * generic 500 unconditionally: bare {Take:0}, {Take:10}, with company_id
 * added directly or via EqualityFilter, all fail identically. Not a payload
 * issue on our side; needs OrnaVerse's team.
 * @returns {Promise<object>} Entities[] of ReasonRow
 */
export async function getReasonCodes() {
  const response = await axiosInstance.post(API.SETTINGS.GET_REASON_CODES, {
    Take: 0,
  });
  return response.data;
}