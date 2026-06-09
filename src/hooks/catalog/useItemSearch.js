'use client';

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';
import { searchItems } from '@/services/catalogService';

const { STALE_TIME, SEARCH } = APP_CONFIG;

/**
 * useItemSearch
 * Fires when item_search >= MIN_QUERY_LENGTH OR any filter array is non-empty
 * OR weight range is set.
 */
export const useItemSearch = (params = {}) => {
  const {
    item_search = '',
    item_group_ids = [],
    type_ids = [],
    sub_type_ids = [],
    from_weight = null,
    to_weight = null,
    from_diamond_weight = null,
    to_diamond_weight = null,
  } = params;

  const hasText = item_search.length >= SEARCH.MIN_QUERY_LENGTH;
  const hasFilters =
    item_group_ids.length > 0 ||
    type_ids.length > 0 ||
    sub_type_ids.length > 0;
  const hasWeightRange =
    from_weight !== null ||
    to_weight !== null ||
    from_diamond_weight !== null ||
    to_diamond_weight !== null;

  const isEnabled = hasText || hasFilters || hasWeightRange;

  const queryParams = {
    item_search,
    item_group_ids,
    type_ids,
    sub_type_ids,
    from_weight,
    to_weight,
    from_diamond_weight,
    to_diamond_weight,
  };

  return useQuery({
    queryKey: QUERY_KEYS.ITEMS.SEARCH(queryParams),
    queryFn: () => searchItems(queryParams),
    enabled: isEnabled,
    staleTime: STALE_TIME.CATALOG,
    select: (data) => data?.data ?? data?.Entities ?? data?.result ?? [],
  });
};