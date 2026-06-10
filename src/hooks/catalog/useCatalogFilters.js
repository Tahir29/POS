// src/hooks/catalog/useCatalogFilters.js

'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import APP_CONFIG from '@/constants/appConfig';

const PARAM = {
  Q: 'q',
};

function buildParams(current, updates) {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === '') {
      next.delete(key);
    } else {
      next.set(key, String(value));
    }
  }
  return next;
}

export function useCatalogFilters() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const activeCategorySlug = (() => {
    for (const [key, value] of searchParams.entries()) {
      if (key !== PARAM.Q && value === '') return key;
    }
    return null;
  })();
  const searchQuery        = searchParams.get(PARAM.Q) ?? '';

  const hasActiveFilters = activeCategorySlug !== null || searchQuery !== '';

  const filters = useMemo(() => ({
    activeCategorySlug,
    searchQuery,
    show_out_of_stock: true,
  }), [activeCategorySlug, searchQuery]);

  const push = useCallback(
    (updates) => {
      const next = buildParams(searchParams, updates);
      const qs   = next.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const selectCategory = useCallback(
    (slug) => {
      const next = new URLSearchParams();
      // Preserve search query if active
      const q = searchParams.get(PARAM.Q);
      if (q) next.set(PARAM.Q, q);
      // Add slug as a key with no value e.g. ?bangles
      if (slug) next.append(slug, '');
      router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ''}`, { scroll: false });
    },
    [push, searchParams, pathname, router],
  );

  const setSearch = useCallback(
    (q) => {
      if (q.length > 0 && q.length < APP_CONFIG.SEARCH.MIN_QUERY_LENGTH) return;
      push({ [PARAM.Q]: q || null });
    },
    [push],
  );

  const clearFilters = useCallback(
    () => router.replace(pathname, { scroll: false }),
    [router, pathname],
  );

  return {
    filters,
    hasActiveFilters,
    actions: {
      selectCategory,
      setSearch,
      clearFilters,
    },
  };
}