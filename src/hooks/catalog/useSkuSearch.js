// Fast, live SKU search — instant results at any catalog size, used as the
// interim/complementary result set while useAllCatalog's full background
// fetch is still loading. See catalogService.searchBySku for why this stays
// reliable where a broad name search over the whole system would not.

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { searchBySku } from '@/services/catalogService';

/**
 * @param {string}      query   - search text (already debounced by the caller)
 * @param {number|null} storeId - current_company_id to scope results to
 */
export function useSkuSearch(query, storeId) {
  return useQuery({
    queryKey: QUERY_KEYS.CATALOG.SKU_SEARCH(query, storeId),
    // `signal` is TanStack Query's own AbortSignal — cancels a superseded
    // keystroke's request on the wire instead of discarding it after completion.
    queryFn:  ({ signal }) => searchBySku({ query, storeId, signal }),
    enabled:  !!query && !!storeId,
    staleTime: 0, // always fresh — this is the fast/live path
  });
}
