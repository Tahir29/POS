// src/hooks/checkout/useOrderHeaderConfig.js
// Resolves the Order/Invoice Create header fields that are neither
// customer- nor cart-derived — financial_year_id and the document type's
// control ledger (ledger_id + posting flags). See apiEndpoints.js
// DOCUMENT_CONFIG block for the full story on how these were root-caused.
//
// Both lookups are near-static (a financial year lasts a full fiscal year;
// document numbering config changes only when an admin reconfigures a
// document type) — cached at STALE_TIME.STATIC like payment modes/location.

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import {
  getFinancialYears,
  resolveCurrentFinancialYear,
  getDocumentNumberingList,
  resolveDocumentConfig,
} from '@/services/documentConfigService';
import { selectActiveStoreId, selectActiveStoreCode } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {number} documentId — the document TYPE constant for this flow
 *   (e.g. 54 = POS Invoice, 53 = POS Order — see DocumentNumbering rows).
 */
export function useOrderHeaderConfig(documentId) {
  const companyId = useSelector(selectActiveStoreId);
  const storeCode = useSelector(selectActiveStoreCode);

  const finYearQuery = useQuery({
    queryKey: QUERY_KEYS.DOCUMENT_CONFIG.FINANCIAL_YEARS(),
    queryFn:  getFinancialYears,
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
  });

  const docNumQuery = useQuery({
    queryKey: QUERY_KEYS.DOCUMENT_CONFIG.DOCUMENT_NUMBERING(),
    queryFn:  getDocumentNumberingList,
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
  });

  // One timestamp shared by both resolutions so a month-boundary crossing
  // mid-render can't pick one period's row against another period's date.
  const now = new Date();

  const currentFinancialYear = finYearQuery.data
    ? resolveCurrentFinancialYear(finYearQuery.data, now)
    : null;

  const docConfig = (docNumQuery.data && companyId)
    ? resolveDocumentConfig(docNumQuery.data, documentId, companyId, now)
    : null;

  // Distinct from isError — the query itself succeeded, there just isn't a
  // DocumentNumbering row for this (documentId, companyId) pair AT ALL.
  // CONFIRMED live 2026-08-14: Credit Note (document_id 123) has ZERO rows
  // across every one of this tenant's 6 stores — not a loading gap, not a
  // network failure, genuinely never configured on OrnaVerse's side. Create
  // 500s if attempted anyway (no ledger_id to send). Without this flag every
  // caller's guard said "still loading — try again in a moment" forever,
  // which is actively misleading for something that will never resolve on
  // its own no matter how long you wait or how many times you retry.
  const isConfigMissing = !!(
    docNumQuery.data && companyId && !docConfig &&
    !docNumQuery.data.some((r) => r.document_id === documentId && r.company_id === companyId)
  );

  // NOTE: no documentNo here on purpose — the server assigns document_no on
  // Create (proven live 2026-07-29) and computing it client-side risks
  // duplicates. See the note at the bottom of documentConfigService.js.
  return {
    financialYearId:        currentFinancialYear?.financial_year_id ?? null,
    ledgerId:                docConfig?.ledger_id ?? null,
    isTaxApplicable:         docConfig?.is_tax_applicable ?? true,
    autoPosting:             docConfig?.auto_posting ?? true,
    isDocumentNumberEditable:docConfig?.is_document_number_editable ?? false,
    // Return headers additionally carry the party's own control ledgers and
    // the document type's backdating window (see the forReturn branch in
    // transactionHeaderService). Not present on every DocumentNumbering row,
    // hence the nullish fallbacks at the point of use.
    payableLedgerId:         docConfig?.payable_ledger_id ?? null,
    receivableLedgerId:      docConfig?.receivable_ledger_id ?? null,
    numberOfBackdatedDays:   docConfig?.number_of_backdated_days ?? null,
    isLoading: finYearQuery.isLoading || docNumQuery.isLoading,
    isReady:   !!currentFinancialYear && !!docConfig,
    // Surfaced so callers can tell "still loading, will resolve on its
    // own" from "genuinely failed, isReady will never become true without
    // a retry" — before this, every one of the ~12 submit-time guards
    // across Order/Invoice/Return/Exchange/Buyback/Credit Note/URD
    // Purchase/Repair/Estimation/Schemes said "still loading — try again
    // in a moment" even when the underlying query had already exhausted
    // its retries and permanently failed, which left every one of those
    // create flows stuck with no way out short of a hard refresh.
    isError: finYearQuery.isError || docNumQuery.isError,
    isConfigMissing,
    refetch: () => {
      finYearQuery.refetch();
      docNumQuery.refetch();
    },
  };
}
