// Infinite-scroll product catalog hook — next page auto-loads when the
// sentinel enters viewport. getProducts() returns
// { Entities, TotalCount, NextRawSkip, Exhausted } — see that function's
// own header (catalogService.js) for why: ProductCatalog/List's
// current_company_id doesn't scope results at all, so getProducts backfills
// across raw tenant-wide pages itself and hands back a real, store-filtered
// Entities list. `pageParam` here is therefore an OPAQUE raw cursor, not a
// display-position offset — always pass back exactly what the previous page
// returned as NextRawSkip, never compute one locally.
// storeId is an explicit param so the catalog page's local store selector
// (catalogStoreId) can override the Redux global store.

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

    getNextPageParam: (lastPage) => lastPage?.Exhausted ? undefined : lastPage?.NextRawSkip ?? undefined,

    select: (data) => ({
      pages:    data.pages,
      products: data.pages.flatMap((page) => page?.Entities ?? []),
    }),

    // 24h — product rows are master data (name, SKU, weight, karat, image
    // fields), persisted to IndexedDB via lib/queryPersister.js so a reload
    // restores instantly. Never used for price — see usePricingEpoch.js.
    staleTime: APP_CONFIG.STALE_TIME.MASTER_DATA,
    gcTime:    APP_CONFIG.STALE_TIME.MASTER_DATA,
    enabled:   !!storeId,
  });
}