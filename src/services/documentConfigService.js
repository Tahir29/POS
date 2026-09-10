// Per-document-type header config needed by Order/Invoice Create — supplies
// financial_year_id and ledger_id, which are neither customer- nor
// cart-derived and must be looked up from here.

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

/**
 * The print/preview formats configured for a document type. Per-tenant
 * configuration, so read rather than hardcoded.
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
 * is_tax_applicable, auto_posting, is_document_number_editable. The document
 * NUMBER itself is assigned server-side (see the note at the bottom of this
 * file).
 *
 * There is one row PER NUMBERING PERIOD, not one per (document_id,
 * company_id), because these document types reset monthly — resolve to the
 * current period rather than naively taking the first match.
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

// document_no is deliberately NOT computed here — the server assigns it on
// Create. A client-side counter derived from DocumentNumbering.last_number is
// unreliable (that field isn't consistently maintained) and risks colliding
// with a document that already exists. Let the server assign the number and
// read it back from Retrieve/List for display.
