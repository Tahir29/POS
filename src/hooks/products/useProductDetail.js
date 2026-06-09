// src/hooks/products/useProductDetail.js

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';
import { getItemDetail } from '@/services/itemService';

/**
 * Fetches full product detail for a single item by ID.
 * @param {number|string} itemId
 */
export function useProductDetail(itemId) {
  const id = itemId ? parseInt(itemId, 10) : null;

  return useQuery({
    queryKey:  QUERY_KEYS.ITEMS.DETAIL(id),
    queryFn:   () => getItemDetail(id),
    enabled:   !!id,
    staleTime: APP_CONFIG.STALE_TIME.CATALOG,
    select:    (data) => data?.data ?? data?.Entity ?? data?.result ?? null,
  });
}