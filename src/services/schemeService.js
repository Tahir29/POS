// src/services/schemeService.js
// Jewellery savings/instalment scheme management.
// All functions are pure HTTP wrappers — no business logic.
//
// SCHEMA — POS.SchemeEnrollmentRow key fields (confirmed v1.json):
//   scheme_enrollment_id  — primary key
//   party_id              — customer
//   party_name            — customer name
//   mobile                — customer mobile
//   scheme_id             — linked scheme
//   scheme_display_name   — scheme name for display
//   scheme_code           — scheme code
//   scheme_status         — enum SchemeStatus (active/inactive/matured/etc.)
//   document_date         — enrollment date
//   scheme_amount         — monthly instalment amount
//   tenure                — months
//   invested_amount       — total paid so far
//   benifit_amount        — ⚠️ API-side typo, preserve EXACTLY — benefit from scheme
//   total_payable         — total amount customer will receive at maturity
//   maturity_year/month   — when scheme matures
//   scheme_monthly_details[] — SchemeMonthlyDetailsRow[]

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

// ─── SCHEME DEFINITIONS ───────────────────────────────────────────────────────

/**
 * All available scheme products (savings plans) at this store.
 * Static-ish — cache for session.
 * @returns {Promise<object>} { Entities: SchemesRow[] }
 */
export async function getSchemes() {
  const response = await axiosInstance.post(API.SCHEMES.LIST, { Take: 0 });
  return response.data;
}

// ─── ENROLLMENTS ──────────────────────────────────────────────────────────────

/**
 * List of scheme enrollments — optionally filtered by customer.
 * @param {{ take?: number, party_id?: number, company_id?: number }} params
 * @returns {Promise<object>} Bare array or { Entities[] } depending on UAT response
 */
export async function getSchemeEnrollments({ take = 0, party_id, company_id } = {}) {
  const response = await axiosInstance.post(API.SCHEMES.ENROLLMENTS_LIST, {
    Take:       take,
    party_id:   party_id   ?? undefined,
    company_id: company_id ?? undefined,
  });
  return response.data;
}

/**
 * Full detail of a single scheme enrollment.
 * @param {number} enrollmentId — scheme_enrollment_id
 * @returns {Promise<object>} { Entity: SchemeEnrollmentRow }
 */
export async function getSchemeEnrollmentById(enrollmentId) {
  const response = await axiosInstance.post(API.SCHEMES.ENROLLMENT_RETRIEVE, {
    EntityId: enrollmentId,
  });
  return response.data;
}

/**
 * Enroll a customer into a scheme.
 * @param {{
 *   party_id:      number,
 *   scheme_id:     number,
 *   scheme_amount: number,
 *   tenure:        number,
 *   company_id:    number,
 *   document_date: string,
 *   nominee?:      string,
 *   nominee_age?:  number
 * }} payload
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function createSchemeEnrollment(payload) {
  const response = await axiosInstance.post(API.SCHEMES.ENROLL, {
    Entity: payload,
  });
  return response.data;
}

// ─── SCHEME RECEIPTS (Monthly payments) ──────────────────────────────────────

/**
 * List of monthly payment receipts for a scheme enrollment.
 * @param {{ scheme_enrollment_id: number, take?: number }} params
 * @returns {Promise<object>} { Entities: SchemeReceiptRow[] }
 */
export async function getSchemeReceipts({ scheme_enrollment_id, take = 0 } = {}) {
  const response = await axiosInstance.post(API.SCHEMES.RECEIPT_LIST, {
    scheme_enrollment_id,
    Take: take,
  });
  return response.data;
}

/**
 * Record a monthly scheme payment from a customer.
 *
 * Payload shape confirmed 2026-07-16 via a real SchemeReceipt/List row —
 * mode_id/ledger_id live nested in scheme_receipt_details[], NOT flat on
 * the header (the original version sent mode_id flat, which doesn't match
 * the real schema). ledger_id comes from the selected payment mode's own
 * ledger_id (see usePaymentModes.js), same pattern as Refund details.
 *
 * @param {{
 *   scheme_enrollment_id: number,
 *   party_id:             number,
 *   company_id:           number,
 *   document_date:        string,
 *   currency_id:          number,
 *   exchange_rate:        number,
 *   amount:               number,
 *   scheme_receipt_details: { mode_id: number, amount: number, ledger_id?: number }[],
 * }} payload
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function createSchemeReceipt(payload) {
  const response = await axiosInstance.post(API.SCHEMES.RECEIPT_CREATE, {
    Entity: payload,
  });
  return response.data;
}

// ─── SCHEME MONTHLY DETAILS ───────────────────────────────────────────────────

/**
 * Month-by-month payment breakdown for a scheme enrollment.
 * @param {{ scheme_enrollment_id: number }} params
 * @returns {Promise<object>} { Entities: SchemeMonthlyDetailsRow[] }
 */
export async function getSchemeMonthlyDetails({ scheme_enrollment_id }) {
  const response = await axiosInstance.post(API.SCHEMES.MONTHLY_DETAILS, {
    scheme_enrollment_id,
    Take: 0,
  });
  return response.data;
}

// ─── SCHEME BENEFIT HELPERS ───────────────────────────────────────────────────

/**
 * Calculate maturity benefit for a scheme enrollment.
 * Call when customer reaches the end of their tenure.
 * @param {{ scheme_enrollment_id: number }} params
 * @returns {Promise<object>} Maturity benefit calculation
 */
export async function getSchemeMaturityBenefit({ scheme_enrollment_id }) {
  const response = await axiosInstance.post(API.SCHEMES.MATURITY_BENEFIT, {
    scheme_enrollment_id,
  });
  return response.data;
}

/**
 * Calculate foreclose benefit (early exit with partial benefit).
 * @param {{ scheme_enrollment_id: number }} params
 * @returns {Promise<object>} Foreclose benefit calculation
 */
export async function getSchemeForcloseBenefit({ scheme_enrollment_id }) {
  const response = await axiosInstance.post(API.SCHEMES.FORECLOSE_BENEFIT, {
    scheme_enrollment_id,
  });
  return response.data;
}

/**
 * Calculate cancellation value (exit with no benefit, refund only).
 * @param {{ scheme_enrollment_id: number }} params
 * @returns {Promise<object>} Cancellation calculation
 */
export async function getSchemeCancellation({ scheme_enrollment_id }) {
  const response = await axiosInstance.post(API.SCHEMES.CANCELLATION, {
    scheme_enrollment_id,
  });
  return response.data;
}