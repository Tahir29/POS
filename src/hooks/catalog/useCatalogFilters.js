// src/hooks/catalog/useCatalogFilters.js
// Manages all catalog filter state, synced to URL query params.
// Covers: category, search, sortBy, showOutOfStock, catalogStoreId.

'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

/**
 * Sort options available in the catalog.
 * Value is used in URL params and matched client-side.
 */
export const SORT_OPTIONS = [
  { value: 'name_asc',    label: 'Name A → Z' },
  { value: 'name_desc',   label: 'Name Z → A' },
  { value: 'price_asc',   label: 'Price Low → High' },
  { value: 'price_desc',  label: 'Price High → Low' },
];

export const DEFAULT_SORT = 'name_asc';

export function useCatalogFilters() {
  const router      = useRouter();
  const pathname    = usePathname();
  const params      = useSearchParams();

  // ── Read from URL ──────────────────────────────────────────────────────────
  const activeCategorySlug  = params.get('category')     ?? null;
  const searchQuery         = params.get('q')            ?? '';
  const sortBy              = params.get('sort')         ?? DEFAULT_SORT;
  const showOutOfStock      = params.get('oos')          === 'true';
  const catalogStoreId      = params.get('store')
    ? Number(params.get('store'))
    : null;

  // ── Write helper ───────────────────────────────────────────────────────────
  const setParam = useCallback((updates) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(updates).forEach(([key, val]) => {
      if (val === null || val === '' || val === false) {
        next.delete(key);
      } else {
        next.set(key, String(val));
      }
    });
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [params, pathname, router]);

  // ── Actions ────────────────────────────────────────────────────────────────
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
      const next = new URLSearchParams();
      // preserve catalogStoreId across clear — it's a scope, not a filter
      if (catalogStoreId) next.set('store', String(catalogStoreId));
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
  }), [setParam, pathname, router, catalogStoreId]);

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