// src/hooks/products/useStockByStores.js

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';
import { getStockByStores } from '@/services/inventoryService';

/**
 * Cross-store stock breakdown for a product.
 * Stale time: 1 minute.
 * @param {number} itemId
 */
export function useStockByStores(itemId) {
  return useQuery({
    queryKey:  QUERY_KEYS.CATALOG.STOCK_BY_STORES(itemId),
    queryFn:   () => getStockByStores(itemId),
    enabled:   !!itemId,
    staleTime: APP_CONFIG.STALE_TIME.STOCK,
    select:    (data) => data?.data ?? data?.Entities ?? data?.result ?? [],
  });
}