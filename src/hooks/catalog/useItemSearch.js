// src/hooks/catalog/useItemSearch.js
//
// Search hook — fires against Items/List (master search).
// Enabled when search query >= MIN_QUERY_LENGTH OR a type filter is active.
//
// searchItems() returns response.data directly.
// Shape: { Entities: [], TotalCount: number, ... }

import { useQuery }    from '@tanstack/react-query';
import { QUERY_KEYS }  from '@/constants/queryKeys';
import APP_CONFIG      from '@/constants/appConfig';
import { searchItems } from '@/services/catalogService';

const { STALE_TIME, SEARCH } = APP_CONFIG;

export function useItemSearch(params = {}) {
  const {
    item_search    = '',
    item_group_ids = [],
    type_ids       = [],
    sub_type_ids   = [],
  } = params;

  const hasText    = item_search.trim().length >= SEARCH.MIN_QUERY_LENGTH;
  const hasFilters = type_ids.length > 0 || item_group_ids.length > 0 || sub_type_ids.length > 0;
  const isEnabled  = hasText || hasFilters;

  return useQuery({
    queryKey: QUERY_KEYS.ITEMS.SEARCH({ item_search, item_group_ids, type_ids, sub_type_ids }),
    queryFn:  () => searchItems({ item_search: item_search.trim(), item_group_ids, type_ids, sub_type_ids }),
    enabled:  isEnabled,
    staleTime: STALE_TIME.CATALOG,
    // searchItems returns response.data → shape: { Entities: [] }
    select: (data) => {
      const result = data?.Entities ?? [];
      return Array.isArray(result) ? result : [];
    },
  });
}
