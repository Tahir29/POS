// src/hooks/returns/useReturns.js
// Paginated list of POS returns for the active store.

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getReturns } from '@/services/returnService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {{ page?: number, pageSize?: number }} options
 */
export function useReturns({ page = 1, pageSize = APP_CONFIG.PAGINATION.DEFAULT_PAGE_SIZE ?? 50 } = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const storeId         = useSelector(selectActiveStoreId);

  const skip = (page - 1) * pageSize;
  const params = { storeId, take: pageSize, skip };

  const query = useQuery({
    queryKey: QUERY_KEYS.RETURNS.LIST(params),
    queryFn:  () => getReturns({ take: pageSize, skip, company_id: storeId }),
    enabled:  !!isAuthenticated && !!storeId,
    staleTime: 2 * 60 * 1000, // 2 minutes — same as orders

    select: (data) => ({
      items:      (data?.Entities ?? []).map(normalizeReturn),
      totalCount: data?.TotalCount ?? 0,
    }),
  });

  return {
    ...query,
    returns:    query.data?.items      ?? [],
    totalCount: query.data?.totalCount ?? 0,
  };
}

// ── Normalizer ────────────────────────────────────────────────
function normalizeReturn(raw) {
  const balanceAmount  = raw.balance_amount  ?? 0;
  const receiptAmount  = raw.receipt_amount  ?? 0;

  let status = 'pending';
  if (balanceAmount <= 0 && receiptAmount > 0) status = 'refunded';
  else if (receiptAmount > 0)                  status = 'partial';

  return {
    transactionId: raw.transaction_id,
    documentNo:    raw.document_no,
    documentDate:  raw.document_date,
    partyName:     raw.party_name ?? '',
    mobile:        raw.mobile     ?? '',
    netAmount:     raw.net_amount ?? 0,
    receiptAmount,
    balanceAmount,
    status,
    raw,
  };
}