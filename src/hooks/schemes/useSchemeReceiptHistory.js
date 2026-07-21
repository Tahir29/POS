// src/hooks/schemes/useSchemeReceiptHistory.js
// Payment (receipt) history for a single scheme enrollment.
//
// Confirmed live 2026-07-22 — Services/POS/SchemeReceipt/List returns
// { Entities: SchemeReceiptRow[] }, each row a payment header with mode/
// ledger details nested under scheme_receipt_details[] (same nesting used
// when creating a receipt — see schemeService.js createSchemeReceipt).

import { useQuery } from '@tanstack/react-query';
import { getSchemeReceipts } from '@/services/schemeService';
import { QUERY_KEYS } from '@/constants/queryKeys';

function normalizeReceipt(raw) {
  // A receipt can (in theory) carry multiple mode splits — join names for
  // display rather than assuming exactly one.
  const details  = raw.scheme_receipt_details ?? [];
  const modeName = details.map((d) => d.mode_name).filter(Boolean).join(', ') || null;

  return {
    id:           raw.scheme_payment_id,
    documentNo:   raw.document_no ?? null,
    documentDate: raw.document_date ?? null,
    amount:       raw.amount ?? 0,
    modeName,
    raw,
  };
}

/**
 * @param {number|null} enrollmentId — scheme_enrollment_id, or null/undefined to disable.
 */
export function useSchemeReceiptHistory(enrollmentId) {
  return useQuery({
    queryKey: QUERY_KEYS.SCHEMES.RECEIPT_LIST(enrollmentId),
    queryFn: async () => {
      const data = await getSchemeReceipts({ scheme_enrollment_id: enrollmentId });
      const rows = data?.Entities ?? [];
      // Most recent first.
      return rows
        .map(normalizeReceipt)
        .sort((a, b) => new Date(b.documentDate ?? 0) - new Date(a.documentDate ?? 0));
    },
    enabled: !!enrollmentId,
  });
}
