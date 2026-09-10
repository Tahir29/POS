// Fast, live category-name search — the interim/complementary result set
// while useAllCatalog's full background fetch is still loading, same role
// as useSkuSearch but for "rings", "earrings", etc. instead of a SKU.
// Many rows have item_name === item_code, so a category name like "Rings"
// won't literally match item_name — this instead resolves the query to a
// real category (via getMatchingTypeIds) and fires the same server-side
// type_ids-filtered ProductCatalog/List query the category filter chip
// uses, rather than scanning the client-side index. One page only — this is
// an interim result set; applySearchFilters takes over once useAllCatalog's
// allReady flips true.

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
