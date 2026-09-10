// DailyClosing/List can't be scoped server-side — it 500s on any
// company-scoping param, so it returns every store's closings unfiltered
// (see dailyClosingService.js). `select` below filters to company_id ===
// the active store client-side as defense-in-depth, so one store's staff
// can't see another store's cash reconciliation data (cash/card/UPI
// totals, notes). storeId also discriminates the cache key so switching
// stores doesn't show stale data. Tradeoff: filtering happens client-side
// after an unscoped Take/Skip page, so a page can come back mostly
// filtered out if other stores dominate the result set — acceptable since
// Daily Closing is low-volume (one record per store per day).

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

    select: (data) => {
      // Defense-in-depth store scoping — see file header. Rows with no
      // company_id are excluded too (fail-closed on financial data).
      const scoped = (data?.Entities ?? []).filter((e) => e.company_id === storeId);
      return {
        items:      scoped.map(normalizeClosing),
        totalCount: scoped.length,
      };
    },
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
    // document_date is the real field; closing_date is a defensive fallback.
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
