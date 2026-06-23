import { useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';
import { getNewItems } from '@/services/catalogService';

/**
 * Fetches all items flagged as new arrivals in OrnaVerse.
 * Used by the Dashboard new arrivals carousel widget.
 * Stale time is STATIC — new arrival flags change infrequently.
 * @returns {import('@tanstack/react-query').UseQueryResult} TanStack Query result object.
 */
export function useNewItems() {
  return useQuery({
    queryKey: QUERY_KEYS.ITEMS.NEW(),
    queryFn: getNewItems,
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
    select: (data) => data?.Entities ?? [],
  });
}
