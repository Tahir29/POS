// src/services/documentConfigService.js
// Per-document-type header config needed by Order/Invoice Create — see
// apiEndpoints.js DOCUMENT_CONFIG block for the full story on why these two
// lookups exist (root cause of the Order/Invoice/Create 500s: financial_year_id
// and ledger_id are neither customer- nor cart-derived, they come from here).

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

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
 * @param {object[]} rows
 * @param {number} documentId
 * @param {number} companyId
 */
export function resolveDocumentConfig(rows, documentId, companyId) {
  return (
    rows.find((r) => r.document_id === documentId && r.company_id === companyId) ?? null
  );
}
