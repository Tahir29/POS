// src/hooks/catalog/useCatalogProducts.js
//
// Infinite-scroll product catalog hook.
// useInfiniteQuery — next page auto-loads when sentinel enters viewport.
//
// IMPORTANT: getProducts() returns response.data directly (not the Axios wrapper).
// So lastPage shape is: { Entities: [], TotalCount: number, Skip: number, Take: number }
// NOT response.data.Entities — just lastPage.Entities

import { useInfiniteQuery } from '@tanstack/react-query';
import { useSelector }      from 'react-redux';
import { getProducts }      from '@/services/catalogService';
import { QUERY_KEYS }       from '@/constants/queryKeys';
import APP_CONFIG           from '@/constants/appConfig';

const selectActiveStoreId = (state) => state.store.activeStoreId;

// Use a larger page size for better UX — 50 per page
const TAKE = 50;

export function useCatalogProducts(filters = {}) {
  const storeId = useSelector(selectActiveStoreId);

  return useInfiniteQuery({
    queryKey: QUERY_KEYS.CATALOG.PRODUCTS({ storeId, ...filters }),

    queryFn: ({ pageParam = 0 }) =>
      getProducts({
        current_company_id: storeId,
        Take:               TAKE,
        Skip:               pageParam,
        show_out_of_stock:  filters.show_out_of_stock ?? true,
        ...(filters.type_ids?.length       && { type_ids:       filters.type_ids }),
        ...(filters.sub_type_ids?.length   && { sub_type_ids:   filters.sub_type_ids }),
        ...(filters.item_group_ids?.length && { item_group_ids: filters.item_group_ids }),
      }),

    initialPageParam: 0,

    // getProducts returns response.data → shape: { Entities, TotalCount, Skip, Take }
    getNextPageParam: (lastPage, allPages) => {
      const items      = lastPage?.Entities ?? [];
      const totalCount = lastPage?.TotalCount ?? 0;
      const loaded     = allPages.length * TAKE;
      // No more pages when we've loaded everything or last page was short
      if (items.length < TAKE || loaded >= totalCount) return undefined;
      return loaded;
    },

    // Flatten all pages into a single products array
    select: (data) => ({
      pages:    data.pages,
      products: data.pages.flatMap((page) => page?.Entities ?? []),
    }),

    staleTime: APP_CONFIG.STALE_TIME.CATALOG,
    enabled:   !!storeId,
  });
}
