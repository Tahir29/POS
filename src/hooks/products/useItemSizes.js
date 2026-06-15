// src/hooks/products/useItemSizes.js
//
// Fetches all available item sizes from ItemsSizes/List.
// OrnaVerse /List endpoints wrap arrays in Entities (not Entity).
// Stale time: 30 min — static master data, rarely changes.

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';
import { getItemSizes } from '@/services/itemService';

export function useItemSizes() {
  return useQuery({
    queryKey:  QUERY_KEYS.ITEMS.SIZES(),
    queryFn:   getItemSizes,
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
    // /List → response.data.Entities
    select: (response) => {
      const result = response?.data?.Entities ?? [];
      return Array.isArray(result) ? result : [];
    },
  });
}
