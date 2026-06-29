// src/hooks/dailyClosing/useDailyClosing.js
// Paginated list of daily closing records for the active store.

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getDailyClosingList } from '@/services/dailyClosingService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import { selectActiveStoreId } from '@/store/slices/storeSlice';

export function useDailyClosing({ page = 1, pageSize = 30 } = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const storeId         = useSelector(selectActiveStoreId);
  const skip = (page - 1) * pageSize;

  const query = useQuery({
    queryKey: QUERY_KEYS.DAILY_CLOSING.LIST(storeId),
    queryFn:  () => getDailyClosingList({ take: pageSize, skip, company_id: storeId }),
    enabled:  !!isAuthenticated && !!storeId,
    staleTime: 5 * 60 * 1000,

    select: (data) => ({
      items:      (data?.Entities ?? []).map(normalizeClosing),
      totalCount: data?.TotalCount ?? 0,
    }),
  });

  return {
    ...query,
    closings:   query.data?.items      ?? [],
    totalCount: query.data?.totalCount ?? 0,
  };
}

function normalizeClosing(raw) {
  return {
    closingId:      raw.transaction_id ?? raw.closing_id,
    closingDate:    raw.closing_date   ?? raw.document_date,
    openingBalance: raw.opening_balance ?? 0,
    closingBalance: raw.closing_balance ?? 0,
    cashSales:      raw.cash_sales      ?? 0,
    cardSales:      raw.card_sales      ?? 0,
    upiSales:       raw.upi_sales       ?? 0,
    otherSales:     raw.other_sales     ?? 0,
    totalSales:     raw.total_sales     ?? 0,
    notes:          raw.notes && raw.notes !== 'NA' ? raw.notes : '',
    raw,
  };
}
