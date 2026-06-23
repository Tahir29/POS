// src/hooks/products/useProductStock.js

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';
import { getStock } from '@/services/inventoryService';

/**
 * Real-time stock check for a product by item_code (SKU).
 * Stale time: 1 minute (stock changes frequently).
 * @param {string} itemCode
 */
export function useProductStock(itemCode) {
  return useQuery({
    queryKey:  QUERY_KEYS.INVENTORY.STOCK(itemCode),
    queryFn:   () => getStock(itemCode),
    enabled:   !!itemCode,
    staleTime: APP_CONFIG.STALE_TIME.STOCK,
    select: (response) => {
      return response?.data?.Entity ?? response?.data?.Entities?.[0] ?? response?.data?.data ?? response?.data ?? null;
    },
  });
}