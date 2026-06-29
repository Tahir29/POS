// src/hooks/exchange/useExchanges.js
// Paginated list of POS exchange transactions for the active store.

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getExchanges } from '@/services/exchangeService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import APP_CONFIG from '@/constants/appConfig';

export function useExchanges({ page = 1, pageSize = APP_CONFIG.PAGINATION.DEFAULT_PAGE_SIZE ?? 50 } = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const storeId         = useSelector(selectActiveStoreId);
  const skip = (page - 1) * pageSize;
  const params = { storeId, take: pageSize, skip };

  const query = useQuery({
    queryKey: QUERY_KEYS.EXCHANGE.LIST(params),
    queryFn:  () => getExchanges({ take: pageSize, skip, company_id: storeId }),
    enabled:  !!isAuthenticated && !!storeId,
    staleTime: 2 * 60 * 1000,
    select: (data) => ({
      items:      (data?.Entities ?? []).map(normalizeExchange),
      totalCount: data?.TotalCount ?? 0,
    }),
  });

  return {
    ...query,
    exchanges:  query.data?.items      ?? [],
    totalCount: query.data?.totalCount ?? 0,
  };
}

function normalizeExchange(raw) {
  return {
    transactionId: raw.transaction_id,
    documentNo:    raw.document_no,
    documentDate:  raw.document_date,
    partyName:     raw.party_name ?? '',
    mobile:        raw.mobile     ?? '',
    netAmount:     raw.net_amount ?? 0,
    exchangeValue: raw.exchange_value ?? raw.net_amount ?? 0,
    status:        raw.status ?? 'posted',
    raw,
  };
}
