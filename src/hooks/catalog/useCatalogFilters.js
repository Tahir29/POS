// Manages all catalog filter state, synced to URL query params.
// Covers: category, search, sortBy, showOutOfStock, catalogStoreId.

'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

/**
 * Sort options available in the catalog. Value is used in URL params and
 * matched client-side.
 */
export const SORT_OPTIONS = [
  { value: 'name_asc',    label: 'Name A → Z' },
  { value: 'name_desc',   label: 'Name Z → A' },
  { value: 'price_asc',   label: 'Price Low → High' },
  { value: 'price_desc',  label: 'Price High → Low' },
  { value: 'weight_asc',  label: 'Weight Low → High' },
  { value: 'weight_desc', label: 'Weight High → Low' },
];

export const DEFAULT_SORT = 'name_asc';

export function useCatalogFilters() {
  const router      = useRouter();
  const pathname    = usePathname();
  const params      = useSearchParams();

  const activeCategorySlug  = params.get('category')     ?? null;
  const searchQuery         = params.get('q')            ?? '';
  const sortBy              = params.get('sort')         ?? DEFAULT_SORT;
  const showOutOfStock      = params.get('oos')          === 'true';
  const catalogStoreId      = params.get('store')
    ? Number(params.get('store'))
    : null;

  // Build the baseline from window.location.search rather than
  // useSearchParams()'s React-managed snapshot, which only updates on its
  // own render schedule — calling this again before a previous update has
  // been reflected could otherwise silently re-apply/restore a param this
  // call meant to remove. Falls back to the hook's snapshot pre-mount (SSR).
  const setParam = useCallback((updates) => {
    const currentSearch = typeof window !== 'undefined' ? window.location.search : `?${params.toString()}`;
    const next = new URLSearchParams(currentSearch);
    Object.entries(updates).forEach(([key, val]) => {
      if (val === null || val === '' || val === false) {
        next.delete(key);
      } else {
        next.set(key, String(val));
      }
    });
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [params, pathname, router]);

  const actions = useMemo(() => ({
    setSearch: (q) => setParam({ q: q || null }),

    selectCategory: (slug) => setParam({
      category: slug === 'all' ? null : (slug ?? null),
    }),

    setSortBy: (val) => setParam({
      sort: val === DEFAULT_SORT ? null : val,
    }),

    setShowOutOfStock: (val) => setParam({
      oos: val ? 'true' : null,
    }),

    setCatalogStore: (storeId) => setParam({
      store: storeId ?? null,
    }),

    clearFilters: () => {
      // Same reasoning as setParam above — read the store param from the
      // real browser URL, not the potentially-lagging catalogStoreId closure.
      const currentSearch = typeof window !== 'undefined' ? window.location.search : '';
      const currentStore = new URLSearchParams(currentSearch).get('store');
      const next = new URLSearchParams();
      // preserve the store scope across clear — it's a scope, not a filter
      if (currentStore) next.set('store', currentStore);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
  }), [setParam, pathname, router]);

  // ── hasActiveFilters — excludes store + sort (those aren't "filters") ──────
  const hasActiveFilters = !!(activeCategorySlug || searchQuery);

  return {
    filters: {
      activeCategorySlug,
      searchQuery,
      sortBy,
      showOutOfStock,
      catalogStoreId,
    },
    hasActiveFilters,
    actions,
  };
}