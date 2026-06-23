// src/hooks/catalog/useCatalogProducts.js
//
// Infinite-scroll product catalog hook.
// useInfiniteQuery — next page auto-loads when sentinel enters viewport.
//
// IMPORTANT: getProducts() returns response.data directly (not the Axios wrapper).
// So lastPage shape is: { Entities: [], TotalCount: number, Skip: number, Take: number }
//
// storeId is now accepted as an explicit param so the catalog page's
// local store selector (catalogStoreId) can override the Redux global store.

import { useInfiniteQuery } from '@tanstack/react-query';
import { getProducts }      from '@/services/catalogService';
import { QUERY_KEYS }       from '@/constants/queryKeys';
import APP_CONFIG           from '@/constants/appConfig';

const TAKE = APP_CONFIG.PAGINATION.CATALOG_TAKE;

/**
 * @param {object}      filters
 * @param {number|null} filters.storeId          - Explicit store ID (overrides Redux global)
 * @param {boolean}     filters.show_out_of_stock
 * @param {number[]}    [filters.type_ids]
 */
export function useCatalogProducts(filters = {}) {
  const { storeId, ...rest } = filters;

  return useInfiniteQuery({
    queryKey: QUERY_KEYS.CATALOG.PRODUCTS({ storeId, ...rest }),

    queryFn: ({ pageParam = 0 }) =>
      getProducts({
        current_company_id: storeId,
        Take:               TAKE,
        Skip:               pageParam,
        show_out_of_stock:  rest.show_out_of_stock ?? false,
        ...(rest.type_ids?.length       && { type_ids:       rest.type_ids }),
        ...(rest.sub_type_ids?.length   && { sub_type_ids:   rest.sub_type_ids }),
        ...(rest.item_group_ids?.length && { item_group_ids: rest.item_group_ids }),
      }),

    initialPageParam: 0,

    getNextPageParam: (lastPage) => {
      const entities   = lastPage?.Entities   ?? [];
      const totalCount = lastPage?.TotalCount  ?? 0;
      const skip       = lastPage?.Skip        ?? 0;
      const pageTake   = lastPage?.Take        ?? TAKE;

      if (entities.length === 0) return undefined;
      const nextSkip = skip + pageTake;
      if (nextSkip >= totalCount) return undefined;
      return nextSkip;
    },

    select: (data) => ({
      pages:    data.pages,
      products: data.pages.flatMap((page) => page?.Entities ?? []),
    }),

    staleTime: APP_CONFIG.STALE_TIME.CATALOG,
    enabled:   !!storeId,
  });
}