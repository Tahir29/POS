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
 * Builds the SchemeReceipt/Create Entity.
 *
 * SHAPE CAPTURED 2026-07-31 from OrnaVerse's own ERP dialog
 * (/POS/SchemeReceipt → New Scheme Receipt), after our version had been
 * returning an opaque 500 for weeks. Two things were wrong:
 *
 *  1. `month_ids` was missing entirely. It is the array of calendar month
 *     numbers this payment covers (["8"] = August), and their own client
 *     refuses to save without it — "Select Month before Receipt". A scheme
 *     receipt has to say WHICH instalment it pays, otherwise the server has
 *     nothing to mark off.
 *  2. We were running this through buildTransactionHeaderFields, which is
 *     built for SALES documents. A scheme receipt is not one — their payload
 *     carries no sub_total / taxable_amount / tax_amount / net_amount /
 *     receipt_amount / balance_amount / promotion_details / is_tax_applicable
 *     at all. It has its own flat shape, built here.
 *
 * Everything below appears in their captured payload; nothing is invented.
 *
 * @param {{
 *   enrollmentId: number, schemeType?: number|string, schemeUniqueCode?: string,
 *   partyId: number, partyName: string,
 *   mobile?: string, email?: string, phoneCode?: string, panNo?: string, address?: string,
 *   activeStoreId: number, financialYearId: number, ledgerId: number,
 *   documentDate: string, monthIds: (number|string)[], amount: number,
 *   goldRate?: number, weight?: number,
 *   allowBackdatedEntry?: boolean, numberOfBackdatedDays?: number,
 *   isDocumentNumberEditable?: boolean,
 *   details: { modeId: number, amount: number, ledgerId?: number,
 *              ledgerName?: string, modeName?: string, bankPos?: string,
 *              chequeNo?: string|null, chequeDate?: string|null,
 *              cardType?: string, refNo?: string }[],
 * }} params
 */
export function buildSchemeReceiptPayload({
  enrollmentId, schemeType, schemeUniqueCode,
  partyId, partyName, mobile, email, phoneCode, panNo, address,
  activeStoreId, financialYearId, ledgerId,
  documentDate, monthIds, amount, goldRate, weight,
  allowBackdatedEntry, numberOfBackdatedDays, isDocumentNumberEditable,
  details,
}) {
  return {
    // document_no deliberately omitted — the server assigns it. Their dialog
    // pre-fills one, but predicting it is what broke Refund settlement; see
    // services/refundService.js.
    document_date: documentDate,
    document_id:   99,          // POS Scheme Receipt, prefix "SPY"
    mobile:     mobile ?? '',
    party_id:   partyId,
    party_name: partyName,
    email:      email ?? '',
    phone_code: phoneCode ?? '',
    pan_no:     panNo ?? '',
    address:    address ?? '',
    scheme_enrollment_id: enrollmentId,
    month_ids: monthIds.map(String),   // ← the field that was missing
    amount,
    gold_rate: goldRate ?? 0,
    weight:    weight ?? 0,
    scheme_receipt_details: details.map((d) => ({
      mode_id:     d.modeId,
      bank_pos:    d.bankPos ?? '',
      cheque_no:   d.chequeNo ?? null,
      cheque_date: d.chequeDate ?? null,
      card_type:   d.cardType ?? '',
      ref_no:      d.refNo ?? '',
      amount:      d.amount,
      ledger_id:   d.ledgerId,
      ledger_name: d.ledgerName ?? '',
      mode_name:   d.modeName ?? '',
    })),
    currency_id:   103,
    exchange_rate: 1,
    ledger_id:     ledgerId,
    financial_year_id: financialYearId,
    company_id:    activeStoreId,
    user_id:       null,
    is_document_number_editable: isDocumentNumberEditable ?? false,
    allow_backdated_entry:       allowBackdatedEntry ?? true,
    number_of_backdated_days:    numberOfBackdatedDays ?? 1000,
    scheme_type:        schemeType != null ? String(schemeType) : '',
    scheme_unique_code: schemeUniqueCode ?? '',
  };
}

/**
 * Record a monthly scheme payment from a customer.
 * Pass the output of buildSchemeReceiptPayload().
 *
 * @param {object} payload
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