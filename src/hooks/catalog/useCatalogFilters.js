// src/hooks/catalog/useCatalogFilters.js
// Manages all catalog filter state, synced to URL query params.
// Covers: category, search, sortBy, showOutOfStock, catalogStoreId.

'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

/**
 * Sort options available in the catalog.
 * Value is used in URL params and matched client-side.
 *
 * NOTE: 'price_asc'/'price_desc' used to mean weight (mislabeled — the
 * options read "Weight Low → High" but sorted by net_weight, not price).
 * Renamed to weight_asc/weight_desc and given real price_asc/price_desc
 * options now that ProductCatalogRow is enriched with a real price
 * (see catalogService.enrichWithPrice).
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

  // FIXED 2026-09-09 — was building `next` from `params.toString()` (the
  // useSearchParams() hook's own React-managed snapshot). That snapshot
  // only updates on its own render schedule, so calling this again before
  // React has actually re-rendered with the PREVIOUS update reflected — a
  // quick clear right on the heels of a debounced search update landing,
  // for instance — reads a baseline that doesn't yet include that previous
  // change and can silently re-apply/restore a param this same call meant
  // to remove. window.location.search is the actual browser URL, never
  // stale, so building the "current" baseline from that instead makes each
  // call correct regardless of whether React's own snapshot has caught up
  // yet. Guarded for the (SSR/very-first-render) case where this runs
  // before window exists, falling back to the hook's own snapshot then.
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
      // Same staleness fix as setParam above — read the store param from
      // the real browser URL, not the potentially-lagging catalogStoreId
      // closure, so a clear right after another update lands still
      // preserves the TRUE current store scope instead of a stale one.
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