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

/**
 * Computes the next document_no for a DocumentNumbering row.
 *
 * REVERSE-ENGINEERED 2026-07-28 from ONE confirmed real example — there is
 * no dedicated "reserve next number" service action in v1.json (checked:
 * only Create/Update/Delete/Retrieve/List), so OrnaVerse's own frontend
 * computes this client-side too and sends it explicitly on Create despite
 * is_document_number_editable:false. Confirmed live: DocumentNumbering row
 * for document_id 53 (RPO/Order), company_id 1 (branch_wise, prefix "RPO",
 * separator "-", prefix_date "[MM]/[YY]", no_of_zeroes 5, prefill_with_zero
 * true) + storeCode "HO" (company_code from Stores/GetUserStores, confirmed
 * live — NOT company_name/mailing_name, which has no such prefix) produces
 * exactly "HO-RPO-07-26-000004" for counter value 4, i.e.:
 *   [branch, prefix, MM, YY, counter].join(separator)
 *   counter = String(n).padStart(no_of_zeroes + 1, '0')
 *
 * This is a best-effort reconstruction from a single sample — a genuine
 * collision is possible if two terminals compute the same next number
 * concurrently (there's no server-side reservation to prevent it). Create
 * should be expected to reject a duplicate document_no with a clear error
 * rather than the opaque generic 500 this whole investigation was about —
 * treat that as a distinct, recoverable failure mode, not evidence this
 * function is wrong.
 *
 * @param {object} docConfigRow — a DocumentNumbering row (see resolveDocumentConfig)
 * @param {string} storeCode — active store's company_code (e.g. "HO")
 * @param {Date} [date]
 */
export function buildDocumentNumber(docConfigRow, storeCode, date = new Date()) {
  const {
    prefix, separator = '', suffix, prefix_date,
    no_of_zeroes = 0, prefill_with_zero, branch_wise,
    increment_by = 1, last_number = 0,
    reset_monthly, reset_yearly, current_month, current_year,
  } = docConfigRow;

  const month = date.getMonth() + 1;
  const year  = date.getFullYear();

  // A new numbering period starts the counter over at 1 rather than
  // continuing last_number — mirrors reset_monthly/reset_yearly on the row.
  const periodChanged = reset_monthly
    ? (current_month !== month || current_year !== year)
    : reset_yearly
      ? current_year !== year
      : false;

  const nextNumber = periodChanged ? 1 : (last_number ?? 0) + (increment_by ?? 1);

  const counterWidth = prefill_with_zero ? no_of_zeroes + 1 : 0;
  const counterStr = counterWidth > 0
    ? String(nextNumber).padStart(counterWidth, '0')
    : String(nextNumber);

  const parts = [];
  if (branch_wise && storeCode) parts.push(storeCode);
  if (prefix) parts.push(prefix);
  if (prefix_date) {
    parts.push(String(month).padStart(2, '0'));
    parts.push(String(year % 100).padStart(2, '0'));
  }
  parts.push(counterStr);

  return parts.join(separator || '') + (suffix || '');
}
