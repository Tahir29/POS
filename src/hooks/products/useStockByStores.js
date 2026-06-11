// src/hooks/products/useStockByStores.js

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';
import { getStockByStores } from '@/services/inventoryService';

/**
 * Cross-store stock breakdown for a product.
 * Stale time: 1 minute.
 * @param {number} itemId
 *
 * GetStockByStores response shape (confirmed from API):
 * response.data = {
 *   Entities: [
 *     { company_id, companyname, pieces, location_id, location_name, ... }
 *   ]
 * }
 */
export function useStockByStores(itemId) {
  return useQuery({
    queryKey:  QUERY_KEYS.CATALOG.STOCK_BY_STORES(itemId),
    queryFn:   () => getStockByStores(itemId),
    enabled:   !!itemId,
    staleTime: APP_CONFIG.STALE_TIME.STOCK,
    select: (response) => {
      // Confirmed shape: response.data.Entities[]
      const entities = response?.data?.Entities;
      if (!Array.isArray(entities)) return [];

      // Group by company_id so each store appears once,
      // summing pieces across multiple locations in the same store.
      const storeMap = new Map();
      for (const entry of entities) {
        const id = entry.company_id;
        if (storeMap.has(id)) {
          storeMap.get(id).pieces += entry.pieces ?? 0;
        } else {
          storeMap.set(id, {
            company_id:  entry.company_id,
            companyname: entry.companyname,
            pieces:      entry.pieces ?? 0,
          });
        }
      }
      return Array.from(storeMap.values());
    },
  });
}
