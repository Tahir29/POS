// src/hooks/catalog/useCatalogProducts.js
// TanStack Query hook for the store-scoped product catalog.
// Requires active store context — disabled when storeId is absent.
// Cache key includes all filter params so each filter permutation caches separately.
// Source of truth: CODING_STANDARDS.md Section 6, API_MAPPING.md Section 6.1

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getProducts } from '@/services/catalogService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

// ── Selector helpers ─────────────────────────────────────────────────────────

const selectProducts = (data) =>
  data?.Entities ?? data?.data ?? data?.result ?? [];

// ── Redux selector ───────────────────────────────────────────────────────────

const selectActiveStoreId = (state) => state.store.activeStoreId;

// ── useCatalogProducts ───────────────────────────────────────────────────────

/**
 * Fetches the store-scoped product catalog with stock awareness.
 *
 * storeId is sourced from Redux (activeStoreId) — never passed as a prop.
 * The query is disabled until storeId is available to prevent requests
 * with a missing current_company_id.
 *
 * Cache invalidation on store switch is handled by the storeSlice action
 * in the application shell (Phase 3) via queryClient.invalidateQueries.
 *
 * @param {Object} [filters]                   - Optional filter params
 * @param {number} [filters.Skip]              - Pagination offset (default 0)
 * @param {boolean} [filters.show_out_of_stock] - Show OOS items (default false)
 * @param {number[]} [filters.type_ids]        - Active category filter
 * @param {number[]} [filters.sub_type_ids]    - Active sub-category filter
 * @param {number[]} [filters.item_group_ids]  - Active item group filter
 *
 * @returns {import('@tanstack/react-query').UseQueryResult}
 * data: Array of catalog product objects with stock status
 */
export function useCatalogProducts(filters = {}) {
  const storeId = useSelector(selectActiveStoreId);

  // Build the full params object used in both the cache key and the service call.
  // Including storeId in params ensures cache is store-scoped automatically.
  const params = {
    storeId,          // cache key discriminator — not sent to API
    ...filters,
  };

  return useQuery({
    queryKey: QUERY_KEYS.CATALOG.PRODUCTS(params),
    queryFn: () =>
      getProducts({
        current_company_id: storeId,
        Take: APP_CONFIG.PAGINATION.CATALOG_TAKE,
        Skip: filters.Skip ?? 0,
        show_out_of_stock: filters.show_out_of_stock ?? false,
        ...(filters.type_ids?.length        && { type_ids:       filters.type_ids }),
        ...(filters.sub_type_ids?.length    && { sub_type_ids:   filters.sub_type_ids }),
        ...(filters.item_group_ids?.length  && { item_group_ids: filters.item_group_ids }),
      }),
    staleTime: APP_CONFIG.STALE_TIME.CATALOG,
    enabled: !!storeId,
    select: selectProducts,
  });
}
