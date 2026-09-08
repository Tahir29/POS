// Reads this store's own walk-in log (lib/mongo/walkins.js) for the
// Walk-ins listing page — see that file's own header for why this exists
// instead of an OrnaVerse endpoint.
//
// Keyed on companyId (2026-09-08) — an admin switching stores clears the
// entire React Query cache anyway (see useActiveStore.js's switchStore),
// but the companyId is in the key regardless so this behaves correctly
// even if that ever changes: a different store is a different query, not
// a stale one.

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { selectAccessToken } from '@/store/slices/authSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';

async function fetchWalkIns({ companyId, fromDate, toDate, token }) {
  const params = new URLSearchParams({ company_id: String(companyId) });
  if (fromDate) params.set('from', fromDate);
  if (toDate)   params.set('to', toDate);

  const res = await fetch(`/api/customers/walkins?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Walk-ins fetch failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.items) ? data.items : [];
}

/**
 * @param {number|null} companyId — the active store; pass null to disable.
 * @param {{ fromDate?: string, toDate?: string }} [range] — YYYY-MM-DD,
 *   native <input type="date"> value format (same convention orders/
 *   invoices use for their own date filters). Omit either bound to leave
 *   that side of the range open.
 */
export function useWalkInsList(companyId, { fromDate, toDate } = {}) {
  const token = useSelector(selectAccessToken);

  const query = useQuery({
    queryKey: QUERY_KEYS.WALKINS.LIST(companyId, fromDate ?? null, toDate ?? null),
    queryFn:  () => fetchWalkIns({ companyId, fromDate, toDate, token }),
    enabled:  !!companyId && !!token,
    staleTime: 60 * 1000,
  });

  return {
    items:     query.data ?? [],
    isLoading: query.isLoading,
    isError:   query.isError,
    refetch:   query.refetch,
  };
}
