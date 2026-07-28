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
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {number} documentId — the document TYPE constant for this flow
 *   (e.g. 54 = POS Invoice, 53 = POS Order — see DocumentNumbering rows).
 */
export function useOrderHeaderConfig(documentId) {
  const companyId = useSelector(selectActiveStoreId);

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

  const currentFinancialYear = finYearQuery.data
    ? resolveCurrentFinancialYear(finYearQuery.data)
    : null;

  const docConfig = (docNumQuery.data && companyId)
    ? resolveDocumentConfig(docNumQuery.data, documentId, companyId)
    : null;

  return {
    financialYearId:        currentFinancialYear?.financial_year_id ?? null,
    ledgerId:                docConfig?.ledger_id ?? null,
    isTaxApplicable:         docConfig?.is_tax_applicable ?? true,
    autoPosting:             docConfig?.auto_posting ?? true,
    isDocumentNumberEditable:docConfig?.is_document_number_editable ?? false,
    isLoading: finYearQuery.isLoading || docNumQuery.isLoading,
    isReady:   !!currentFinancialYear && !!docConfig,
  };
}
