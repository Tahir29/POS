import { useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';
import { getFeaturedItems } from '@/services/catalogService';

/**
 * Fetches all items flagged as featured in OrnaVerse.
 * Used by the Dashboard featured products carousel widget.
 * Stale time is STATIC — featured flags change infrequently.
 * @returns {import('@tanstack/react-query').UseQueryResult} TanStack Query result object.
 */
export function useFeaturedItems() {
  return useQuery({
    queryKey: QUERY_KEYS.ITEMS.FEATURED(),
    queryFn: getFeaturedItems,
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
    select: (data) => data?.Entities ?? [],
  });
}
