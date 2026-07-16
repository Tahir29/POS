// src/hooks/dailyClosing/useDailyClosing.js
// Paginated list of daily closing records.
//
// NOT scoped to the active store — DailyClosing/List crashes with a 500 the
// moment any company-scoping param is sent, in any spelling (confirmed
// 2026-07-16, see dailyClosingService.js header). Shows every store's
// closings until OrnaVerse fixes the endpoint. storeId is still used as a
// cache-key discriminator so switching stores doesn't show stale data from
// a previous query.

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
    queryFn:  () => getDailyClosingList({ take: pageSize, skip }),
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
    // document_date is the confirmed real field (see file header) —
    // closing_date kept only as a defensive fallback.
    closingDate:    raw.document_date  ?? raw.closing_date,
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
