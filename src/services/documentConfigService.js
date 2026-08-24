// Per-document-type header config needed by Order/Invoice Create — see
// apiEndpoints.js DOCUMENT_CONFIG block for the full story on why these two
// lookups exist (root cause of the Order/Invoice/Create 500s: financial_year_id
// and ledger_id are neither customer- nor cart-derived, they come from here).

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

/**
 * The print/preview formats configured for a document type.
 *
 * Captured from OrnaVerse's own POS 2026-08-05: this is the call they make
 * immediately after Invoice/Create, to offer the operator a "Select Report"
 * choice. Which formats exist is per-tenant configuration, so they're read
 * rather than hardcoded — this tenant returns three for POS Invoice (54).
 *
 * @param {number} documentId
 * @returns {Promise<{report_id, report_name, report_key, report_file,
 *                    report_folder, report_sub_folder?}[]>}
 */
export async function getDocumentReports(documentId) {
  const response = await axiosInstance.post(API.DOCUMENT_CONFIG.DOCUMENT_REPORTS_LIST, {
    document_id: documentId,
    is_disabled: false,
  });
  return response.data?.Entities ?? [];
}

/**
 * All financial year rows (no company/document scoping — same list applies
 * everywhere). Resolve the CURRENT one client-side by matching today against
 * [from_date, to_date].
 * @returns {Promise<{financial_year_id:number, from_date:string, to_date:string, financial_year_code:string}[]>}
 */
export async function getFinancialYears() {
  const response = await axiosInstance.post(API.DOCUMENT_CONFIG.FINANCIAL_YEAR_LIST, {});
  return response.data?.Entities ?? [];
}

/**
 * Find the financial year row covering `date` (defaults to now).
 * @param {Date} [date]
 */
export function resolveCurrentFinancialYear(financialYears, date = new Date()) {
  const t = date.getTime();
  return (
    financialYears.find((fy) => {
      const from = new Date(fy.from_date).getTime();
      const to   = new Date(fy.to_date).getTime();
      return t >= from && t <= to;
    }) ?? null
  );
}

/**
 * DocumentNumbering rows — one per (document_id, company_id) combination.
 * Carries the document type's control ledger + posting flags (ledger_id,
 * is_tax_applicable, auto_posting, is_document_number_editable) that
 * Order/Invoice Create expect on the header and that are NOT derivable from
 * the customer or the cart.
 * @returns {Promise<object[]>}
 */
export async function getDocumentNumberingList() {
  const response = await axiosInstance.post(API.DOCUMENT_CONFIG.DOCUMENT_NUMBERING_LIST, {});
  return response.data?.Entities ?? [];
}

/**
 * Find the DocumentNumbering row for a given document type at a given store.
 *
 * Used ONLY for that document type's posting config — ledger_id,
 * is_tax_applicable, auto_posting, is_document_number_editable. The
 * document NUMBER itself is assigned server-side; see the note at the
 * bottom of this file for why we no longer compute it here.
 *
 * NOTE (2026-07-29): there is NOT one row per (document_id, company_id) —
 * there's one row PER NUMBERING PERIOD, because these document types use
 * reset_monthly. Confirmed live on UAT: (document_id 53, company_id 1)
 * returns SEVEN rows — 2025-04, 2025-09, 2025-10, 2025-11, 2026-01,
 * 2026-05, 2026-07 — each with its own last_number. A naive `.find()`
 * returns the OLDEST (2025-04). The config fields we read are identical
 * across periods so that wouldn't currently cause a visible bug, but
 * resolving to the current period is the correct, future-proof choice.
 *
 * @param {object[]} rows
 * @param {number} documentId
 * @param {number} companyId
 * @param {Date} [date] — the period to resolve for (defaults to now)
 * @returns {object|null} the current-period row, falling back to the most
 *   recent prior period when this month has no row yet, or null when this
 *   document type isn't configured for this store at all.
 */
export function resolveDocumentConfig(rows, documentId, companyId, date = new Date()) {
  const month = date.getMonth() + 1;
  const year  = date.getFullYear();

  const forDocAndStore = rows.filter(
    (r) => r.document_id === documentId && r.company_id === companyId
  );
  if (forDocAndStore.length === 0) return null;

  const currentPeriod = forDocAndStore.find(
    (r) => r.current_month === month && r.current_year === year
  );
  if (currentPeriod) return currentPeriod;

  // No row for this period yet — the server creates one when the first
  // document of the month is raised. Fall back to the latest prior row,
  // whose posting config is what we actually need.
  return forDocAndStore.reduce((latest, r) => {
    const rKey = (r.current_year ?? 0) * 100 + (r.current_month ?? 0);
    const lKey = (latest.current_year ?? 0) * 100 + (latest.current_month ?? 0);
    return rKey > lKey ? r : latest;
  }, forDocAndStore[0]);
}

// ─── document_no: DELIBERATELY NOT COMPUTED HERE ────────────────────────────
//
// There used to be a buildDocumentNumber() here that reconstructed the next
// document number client-side from the DocumentNumbering row. It's gone —
// PROVEN UNNECESSARY AND UNSAFE by two live UAT findings on 2026-07-29:
//
// 1. UNNECESSARY. POS/Order/Create was called with document_no omitted
//    entirely and returned 200 {"EntityId":258}. The server assigned
//    "HO-RPO-07-26-00005" and atomically advanced that period's
//    last_number 4 → 5. Server-side numbering works; ours was redundant.
//
//    (The earlier belief that document_no was required came from a test
//    where it was added at the same time as party_name/mobile/pieces/
//    weight/receipt_amount/balance_amount/promotion_details. One of THOSE
//    was the real fix; document_no was never isolated. Now it has been.)
//
// 2. UNSAFE. last_number is not reliably maintained, so any client-side
//    counter can collide with a document that already exists. Confirmed on
//    UAT: document_id 56 (Exchange) / company_id 1 has NO row for 2026-07
//    (latest is 2026-06) even though a real July document
//    "HO-EXC-07-26-00001" exists. A client computing from that config
//    would regenerate the SAME number — a guaranteed duplicate. There is
//    also no "reserve next number" action in v1.json to make it atomic.
//
// So: never send document_no on Create. Let the server assign it, then read
// it back from the Retrieve/List response for display. If a future change
// makes document_no genuinely required for some document type, prefer
// deriving the counter from that type's own */List (real documents) over
// DocumentNumbering.last_number, and expect to handle duplicate-number
// rejections as a normal, retryable outcome.
