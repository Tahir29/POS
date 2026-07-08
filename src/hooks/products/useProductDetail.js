// src/hooks/products/useProductDetail.js
//
// Fetches a single item's full detail from Items/Retrieve.
// OrnaVerse /Retrieve endpoints always wrap single records in Entity (not Entities).

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';
import { getItemDetail } from '@/services/itemService';

export function useProductDetail(itemId) {
  const id = itemId ? parseInt(itemId, 10) : null;

  return useQuery({
    queryKey:  QUERY_KEYS.ITEMS.DETAIL(id),
    queryFn:   () => getItemDetail(id),
    enabled:   !!id,
    staleTime: APP_CONFIG.STALE_TIME.CATALOG,
    // /Retrieve → response.data.Entity
    select: (response) => {
      const item = response?.data?.Entity ?? null;

      // TEMP DEBUG — remove once diamond Colour/Clarity/Cut/Cert field names
      // are confirmed from the live response. Logs the full raw item so you
      // can inspect exact field names in the browser console (no Postman needed).
      if (item) {
        console.log('[useProductDetail] raw Items/Retrieve Entity:', item);
        console.log('[useProductDetail] diamond-related keys:', Object.keys(item).filter((k) => k.toLowerCase().includes('diamond') || k.toLowerCase().includes('colour') || k.toLowerCase().includes('color') || k.toLowerCase().includes('clarity') || k.toLowerCase().includes('cut') || k.toLowerCase().includes('cert')));
      }

      return item && typeof item === 'object' && !Array.isArray(item) ? item : null;
    },
  });
}