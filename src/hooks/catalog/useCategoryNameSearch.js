// src/hooks/catalog/useCategoryNameSearch.js
// Fast, live category-name search — the interim/complementary result set
// while useAllCatalog's full background fetch is still loading, same role
// as useSkuSearch but for "rings", "earrings", etc. instead of a SKU.
//
// BUG FIXED 2026-07-28: searching a whole category name (e.g. "Rings") on a
// store where matching products' item_name doesn't literally contain the
// word "Ring" (item_name === item_code on many rows — confirmed live) came
// back "No products found" until the full-catalog background index
// finished, because the pre-index fallback path only had useSkuSearch's
// SKU-only server search to fall back on — it has no concept of category
// names at all. Categories themselves (useCategories) load fast and
// independently of the slow full-catalog scan, so once the query resolves
// to a real category via getMatchingTypeIds, this fires the SAME
// server-side type_ids-filtered ProductCatalog/List query the category
// filter CHIP already uses (proven fast — see useCatalogProducts), instead
// of waiting on a client-side scan of possibly thousands of rows.
//
// One page only (not paginated) — this is explicitly an interim result set;
// applySearchFilters takes over with the complete, correctly-sorted result
// once useAllCatalog's allReady flips true.

import { useQuery } from '@tanstack/react-query';
import { getProducts } from '@/services/catalogService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {number[]}    typeIds  - category type_ids the current search query matched
 * @param {number|null} storeId  - current_company_id to scope results to
 * @param {boolean}     enabled  - caller gates this (only while the full index isn't ready)
 */
export function useCategoryNameSearch(typeIds, storeId, enabled) {
  const hasTypeIds = typeIds.length > 0;

  return useQuery({
    queryKey: QUERY_KEYS.CATALOG.CATEGORY_SEARCH(typeIds, storeId),
    queryFn: () => getProducts({
      current_company_id: storeId,
      Take:               APP_CONFIG.PAGINATION.CATALOG_TAKE,
      Skip:                0,
      show_out_of_stock:   true,
      type_ids:            typeIds,
    }),
    select:    (data) => data?.Entities ?? [],
    enabled:   enabled && hasTypeIds && !!storeId,
    staleTime: 0, // always fresh — this is the fast/live interim path
  });
}
