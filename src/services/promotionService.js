// src/services/promotionService.js
// Promotions and gift vouchers — CRM module.
// All functions are pure HTTP wrappers — no business logic.

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

// ─── PROMOTIONS ───────────────────────────────────────────────────────────────

/**
 * Fetches every promotion record. GetPromotion does not filter by code
 * (confirmed 2026-07-15 — it returns the same fixed record regardless of
 * input), so code validation and the checkout promo picker both work off
 * this full list, filtered/matched client-side.
 * @returns {Promise<import('axios').AxiosResponse>} { Entities: PromotionRow[], TotalCount }
 */
export function listPromotions() {
  return axiosInstance.post(API.CRM.LIST, { Take: 0 });
}

/**
 * Apply promotions to a transaction (order/invoice in draft).
 * OrnaVerse calculates and returns the applicable discount.
 * @param {{
 *   transaction_id: number,
 *   company_id:     number,
 *   party_id?:      number
 * }} params
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function applyPromotions({ transaction_id, company_id, party_id }) {
  return axiosInstance.post(API.CRM.APPLY_PROMOTIONS, {
    transaction_id,
    company_id,
    party_id: party_id ?? undefined,
  });
}

/**
 * Reverse a previously applied promotion on a draft transaction.
 * @param {{ transaction_id: number }} params
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function reversePromotion({ transaction_id }) {
  return axiosInstance.post(API.CRM.REVERSE_PROMOTION, { transaction_id });
}

// ─── GIFT VOUCHERS ────────────────────────────────────────────────────────────

/**
 * Check whether a gift voucher code is valid and has balance remaining.
 * Call before showing the voucher as a payment option at checkout.
 * @param {{ voucher_code: string, company_id: number }} params
 * @returns {Promise<import('axios').AxiosResponse>} Voucher balance and validity
 */
export function checkGiftVoucherUtilization({ voucher_code, company_id }) {
  return axiosInstance.post(API.CRM.GIFT_VOUCHER_CHECK_UTILIZATION, {
    voucher_code,
    company_id,
  });
}

/**
 * Redeem a gift voucher against a transaction.
 * Call after the customer confirms they want to use the voucher.
 * @param {{
 *   voucher_code:   string,
 *   transaction_id: number,
 *   amount:         number,
 *   company_id:     number
 * }} params
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function redeemGiftVoucher({ voucher_code, transaction_id, amount, company_id }) {
  return axiosInstance.post(API.CRM.GIFT_VOUCHER_REDEEM, {
    voucher_code,
    transaction_id,
    amount,
    company_id,
  });
}