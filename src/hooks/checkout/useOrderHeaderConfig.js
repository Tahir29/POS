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

  // Distinct from isError — the query succeeded, there's just no
  // DocumentNumbering row configured for this (documentId, companyId) pair
  // (e.g. Credit Note/123 has none on this tenant), which Create will 500 on.
  // Surfaced separately so a caller doesn't show "still loading" forever for
  // something that will never resolve no matter how many times it's retried.
  const isConfigMissing = !!(
    docNumQuery.data && companyId && !docConfig &&
    !docNumQuery.data.some((r) => r.document_id === documentId && r.company_id === companyId)
  );

  // No documentNo here on purpose — the server assigns document_no on Create;
  // computing it client-side risks duplicates. See documentConfigService.js.
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
    // Lets submit-time guards distinguish "still loading" from "genuinely
    // failed" so a permanently-failed query doesn't get stuck saying "try
    // again in a moment" forever.
    isError: finYearQuery.isError || docNumQuery.isError,
    isConfigMissing,
    refetch: () => {
      finYearQuery.refetch();
      docNumQuery.refetch();
    },
  };
}
