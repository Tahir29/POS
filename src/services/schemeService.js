// Jewellery savings/instalment scheme management.
// All functions are pure HTTP wrappers — no business logic.
//
// SCHEMA — POS.SchemeEnrollmentRow key fields:
//   scheme_enrollment_id  — primary key
//   party_id / party_name / mobile — customer
//   scheme_id / scheme_display_name / scheme_code — linked scheme
//   scheme_status         — enum SchemeStatus: 1 active, 0 cancelled/
//                           foreclosed-pending, 2 matured-pending,
//                           3 redeemed (terminal); meaning of 0/2/3 not
//                           confirmed against a real transition, see
//                           closeSchemeEnrollment below
//   document_date         — enrollment date
//   scheme_amount         — monthly instalment amount
//   tenure                — months
//   scheme_bonus_value    — cash value of the base bonus (scheme_amount × bonus_value)
//   max_installment_amount— copied from the scheme master, cap per instalment
//   invested_amount       — total paid so far
//   benifit_amount        — API-side typo, preserve EXACTLY — benefit from scheme
//   total_payable         — total amount customer will receive at maturity
//   maturity_year/month   — when scheme matures
//   nominee / nominee_age — optional; confirmed sent on Create, not yet
//                           confirmed round-tripping back on List/Retrieve
//   scheme_monthly_details[] — SchemeMonthlyDetailsRow[]; MUST be built and
//                           sent by the client on Create (see
//                           buildSchemeMonthlyDetails() below) — the server
//                           does not synthesize these from scheme_amount/
//                           tenure alone

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

/**
 * All available scheme products (savings plans) at this store.
 * Static-ish — cache for session.
 * @returns {Promise<object>} { Entities: SchemesRow[] }
 */
export async function getSchemes() {
  const response = await axiosInstance.post(API.SCHEMES.LIST, { Take: 0 });
  return response.data;
}

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
 * Builds the SchemeEnrollment/Create scheme_monthly_details[] rows — the
 * server does not generate these itself from scheme_amount/tenure/
 * document_date, the client must build and send every row. One row per
 * tenure month, first due date equal to the enrollment date, one calendar
 * month added per subsequent row.
 *
 * @param {string} documentDate  — enrollment date, "YYYY-MM-DD"
 * @param {number} schemeAmount  — monthly instalment amount
 * @param {number} tenure        — number of months
 * @returns {{ month_id: number, month_amount: number, due_date: string, payment_made: boolean }[]}
 */
export function buildSchemeMonthlyDetails(documentDate, schemeAmount, tenure) {
  const base = new Date(`${documentDate}T00:00:00`);
  const rows = [];
  for (let i = 0; i < tenure; i++) {
    const due = new Date(base);
    due.setMonth(due.getMonth() + i);
    rows.push({
      month_id:     due.getMonth() + 1, // calendar month number, 1–12
      month_amount: schemeAmount,
      due_date:     due.toISOString(),
      payment_made: false,
    });
  }
  return rows;
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
 *   scheme_monthly_details: object[], // build via buildSchemeMonthlyDetails()
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
 * The configured benefit rules for one scheme — see API.SCHEMES.RULES_LIST's
 * own comment for the confirmed live shape. Per-scheme, not shared/global.
 * @param {number} schemeId
 * @returns {Promise<object[]>} SchemeRulesRow[]
 */
export async function getSchemeRules(schemeId) {
  const response = await axiosInstance.post(API.SCHEMES.RULES_LIST, {
    scheme_id: schemeId,
    Take:      0,
  });
  return response.data?.Entities ?? [];
}

/**
 * Builds the SchemeReceipt/Create Entity. This is NOT a sales document, so it
 * does not go through buildTransactionHeaderFields (no sub_total/
 * taxable_amount/tax_amount/net_amount/promotion_details) — it has its own
 * flat shape, built here.
 *
 * `month_ids` (array of calendar month numbers this payment covers, e.g.
 * ["8"] for August) is required — a scheme receipt has to say WHICH
 * instalment it pays, or the server has nothing to mark off.
 *
 * @param {{
 *   enrollmentId: number, schemeType?: number, schemeUniqueCode?: string,
 *   partyId: number, partyName: string,
 *   mobile?: string, email?: string, phoneCode?: string, panNo?: string, address?: string,
 *   activeStoreId: number, financialYearId: number, ledgerId: number,
 *   documentDate: string, monthIds: number[], amount: number,
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
    // document_no deliberately omitted — the server assigns it. Predicting
    // it client-side is what broke Refund settlement; see refundService.js.
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
    // CONFIRMED LIVE 2026-09-18 (real multi-month SchemeReceipt/Create
    // payload from OrnaVerse's own client, e.g. month_ids:[9,10,11,12,1,2]):
    // these are JSON numbers, not strings. Was `.map(String)` before —
    // worked in practice (loose server-side coercion), but didn't match
    // the real contract; fixed to remove the guess now that it's confirmed.
    month_ids: monthIds.map(Number),
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
    // CONFIRMED LIVE 2026-09-18 (same real capture as month_ids above):
    // scheme_type:1, a number — was String(schemeType) before, also fixed.
    scheme_type:        schemeType != null ? Number(schemeType) : null,
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
// ALL THREE TAKE THE WHOLE ENROLLMENT, NOT AN ID — the server needs the full
// scheme_monthly_details rows to compute a figure; an ID alone hits an
// unguarded path server-side and 500s.

/**
 * Fetches the full enrollment entity — the input these calculators need.
 * @param {number} enrollmentId
 * @returns {Promise<object|null>} the enrollment Entity
 */
export async function getSchemeEnrollmentDetail(enrollmentId) {
  const response = await axiosInstance.post(API.SCHEMES.ENROLLMENT_RETRIEVE, {
    EntityId: enrollmentId,
  });
  return response.data?.Entity ?? null;
}

async function postBenefitCalc(endpoint, enrollment) {
  const response = await axiosInstance.post(endpoint, { enrollment });
  return response.data;
}

/**
 * Maturity benefit — the payout at the end of the full tenure.
 *
 * PRECONDITION: every instalment must be paid first; callers should check
 * with canMatureEnrollment() below before calling.
 *
 * @param {object} enrollment — full entity from getSchemeEnrollmentDetail()
 */
export async function getSchemeMaturityBenefit(enrollment) {
  return postBenefitCalc(API.SCHEMES.MATURITY_BENEFIT, enrollment);
}

/**
 * Foreclose benefit — early exit, partial benefit.
 * @param {object} enrollment — full entity from getSchemeEnrollmentDetail()
 */
export async function getSchemeForcloseBenefit(enrollment) {
  return postBenefitCalc(API.SCHEMES.FORECLOSE_BENEFIT, enrollment);
}

/**
 * Cancellation value — exit with no benefit, refund only.
 * @param {object} enrollment — full entity from getSchemeEnrollmentDetail()
 */
export async function getSchemeCancellation(enrollment) {
  return postBenefitCalc(API.SCHEMES.CANCELLATION, enrollment);
}

/**
 * Mirrors OrnaVerse's own client-side gate on Calculate Maturity, so staff
 * see a clear message instead of a server error.
 *
 * @param {object} enrollment — full entity (needs scheme_monthly_details)
 * @returns {{ allowed: boolean, remaining: number }}
 */
export function canMatureEnrollment(enrollment) {
  const rows = enrollment?.scheme_monthly_details ?? [];
  const remaining = rows.filter((m) => !m.payment_made).length;
  return { allowed: rows.length > 0 && remaining === 0, remaining };
}

// rule_type 3 = the foreclosure eligibility window on a SchemeRulesRow —
// CONFIRMED LIVE 2026-09-18: scheme_id 3 ("Vault of dream")'s own rule_type
// 3 row has from_installment:6, matching that exact scheme's real rejection
// message ("To foreclose you need to pay at least 6 installments") from
// OrnaVerse's own client. This is genuinely PER-SCHEME, not a universal
// constant — scheme_id 5 ("New year")'s rule_type 3 row has
// from_installment:1 instead. GetSchemeForcloseBenefit itself doesn't
// reject a too-early call server-side (confirmed separately: it happily
// returns a real ₹0-benefit calculation for a 1-instalment enrollment on
// scheme 3), so this is a real UI-level precondition, not derivable from
// that endpoint's own behavior — canForecloseEnrollment needs this
// scheme's real rules, not just the enrollment itself.
const FORECLOSE_RULE_TYPE = 3;

/**
 * Mirrors OrnaVerse's own client-side gate on Calculate Foreclosure — see
 * FORECLOSE_RULE_TYPE's own comment for how the real minimum is found.
 *
 * @param {object} enrollment — full entity (needs scheme_monthly_details)
 * @param {object[]} schemeRules — this enrollment's scheme's rules, from
 *   getSchemeRules(enrollment.scheme_id)
 * @returns {{ allowed: boolean, paid: number, required: number }}
 */
export function canForecloseEnrollment(enrollment, schemeRules) {
  const rows = enrollment?.scheme_monthly_details ?? [];
  const paid = rows.filter((m) => m.payment_made).length;
  const rule = (schemeRules ?? []).find((r) => r.rule_type === FORECLOSE_RULE_TYPE);
  // No configured rule for this scheme — fail open (allow) rather than
  // block a scheme that may simply not restrict foreclosure at all; the
  // server itself is the final say either way.
  const required = rule?.from_installment ?? 1;
  return { allowed: paid >= required, paid, required };
}

// CONFIRMED LIVE 2026-09-18: captured the ACTUAL SchemeEnrollment/Update
// request body OrnaVerse's own client sends on a real cancellation (Calculate
// Cancellation → Cancel Scheme) — it explicitly sets scheme_status:0 and
// benifit_amount:0 in that write (even though the real refund/payout was
// ₹1,000 — see benefitAmountToRecord's own comment in EnrollmentDetailSheet.jsx).
// This is the client's own real payload, not an inferred after-the-fact
// read, so it's as confirmed as this gets without OrnaVerse's written docs.
// Matches this file's own long-standing but previously-unconfirmed schema
// guess ("0 cancelled/foreclosed-pending").
//
// maturity:2 CONFIRMED LIVE the same day, separately: paid all 9
// instalments, ran Calculate Maturity, clicked Mature — a subsequent
// Retrieve showed scheme_status:2 (plus benifit_amount/invested_amount/
// total_payable and each scheme_monthly_details row's own benefit_amount
// all populated for the first time). OrnaVerse's own client badge briefly
// still read "Active" until the page was refreshed, then correctly showed
// "Matured" — confirmed as a client-side staleness quirk on their end, not
// a reason to doubt the value. Matches this file's own guess ("2
// matured-pending") too.
//
// foreclose is still unconfirmed — a foreclosed enrollment's real
// scheme_status was never separately captured, so it's deliberately absent
// here rather than assumed to share maturity's or cancellation's value.
const CONFIRMED_STATUS_BY_KIND = {
  cancellation: 0,
  maturity:     2,
};

/**
 * Records a closure benefit (and, for confirmed kinds, the resulting
 * status) against the enrollment.
 *
 * There is no dedicated close/mature/foreclose/cancel endpoint in the API —
 * SchemeEnrollment/Update is the only mutation available on this entity.
 * Only `benifit_amount` (see the header note on the API's own typo) plus
 * whatever CONFIRMED_STATUS_BY_KIND above already proves for `kind` are
 * written — an unconfirmed kind leaves scheme_status untouched rather than
 * guess at Matured vs. Foreclosed's real enum value.
 *
 * @param {{ enrollmentId: number, benefitAmount: number, kind?: 'maturity'|'foreclose'|'cancellation' }} params
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function closeSchemeEnrollment({ enrollmentId, benefitAmount, kind }) {
  const enrollment = await getSchemeEnrollmentDetail(enrollmentId);
  if (!enrollment) throw new Error('Could not load this enrollment.');

  const confirmedStatus = kind ? CONFIRMED_STATUS_BY_KIND[kind] : undefined;

  const response = await axiosInstance.post(API.SCHEMES.ENROLLMENT_UPDATE, {
    EntityId: enrollmentId,
    Entity: {
      ...enrollment,
      benifit_amount: benefitAmount,
      ...(confirmedStatus !== undefined && { scheme_status: confirmedStatus }),
    },
  });
  return response.data;
}

/**
 * Redeems a MATURED enrollment (scheme_status:2 → 3) — CONFIRMED LIVE
 * 2026-09-18 as a genuinely separate action from Mature, not a second call
 * to closeSchemeEnrollment: the real captured Redeem Update carries every
 * field over unchanged from the already-Matured entity (including
 * benifit_amount/invested_amount/total_payable, all set at Mature time) —
 * only scheme_status itself moves. So this deliberately does NOT touch
 * benifit_amount at all, unlike closeSchemeEnrollment which always writes
 * a freshly-calculated one.
 *
 * @param {number} enrollmentId
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function redeemSchemeEnrollment(enrollmentId) {
  const enrollment = await getSchemeEnrollmentDetail(enrollmentId);
  if (!enrollment) throw new Error('Could not load this enrollment.');

  const response = await axiosInstance.post(API.SCHEMES.ENROLLMENT_UPDATE, {
    EntityId: enrollmentId,
    Entity: {
      ...enrollment,
      scheme_status: 3,
    },
  });
  return response.data;
}
