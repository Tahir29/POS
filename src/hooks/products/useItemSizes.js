// src/hooks/products/useItemSizes.js

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';
import { getItemSizes } from '@/services/itemService';

/**
 * Fetches all available item sizes.
 * Stale time: 30 minutes (static master data).
 */
export function useItemSizes() {
  return useQuery({
    queryKey:  QUERY_KEYS.ITEMS.SIZES(),
    queryFn:   getItemSizes,
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
    select:    (data) => data?.data ?? data?.Entities ?? data?.result ?? [],
  });
}