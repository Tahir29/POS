// src/hooks/dailyClosing/useDailyClosing.js
// Paginated list of daily closing records.
//
// The underlying DailyClosing/List call can't be scoped server-side — it
// crashes with a 500 the moment any company-scoping param is sent, in any
// spelling (confirmed 2026-07-16, see dailyClosingService.js header), so it
// returns every store's closings unfiltered. SECURITY FIX (2026-07-22):
// this used to render that unfiltered result directly, meaning any
// authenticated staff member could see every other store's end-of-day cash
// reconciliation data (cash/card/UPI totals, notes) regardless of which
// store they're assigned to. `select` below now filters to company_id ===
// the active store client-side, as defense-in-depth, matching how every
// sibling list endpoint (Returns/Refunds/Exchanges/Buybacks/URD/Reports)
// already scopes by company_id server-side. storeId is also still used as
// a cache-key discriminator so switching stores doesn't show stale data
// from a previous query.
//
// Tradeoff: because filtering happens client-side after an unscoped
// Take/Skip page, a page can come back mostly filtered out if other stores
// dominate the underlying (unscoped) result set. Daily Closing is a
// low-volume entity (one record per store per day), so this is an
// acceptable cost for closing the cross-store data exposure.

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
      // Defense-in-depth store scoping — see file header. Only keep rows
      // that actually belong to the active store; a row with no company_id
      // at all is excluded too (fail-closed, not fail-open, on financial data).
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
