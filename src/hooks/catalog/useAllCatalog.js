// src/hooks/catalog/useAllCatalog.js
// Fetches the complete product catalog for a given store, for client-side
// search, filter, and barcode lookup on the catalog page.
//
// getAllProducts paginates the store's real inventory in chunks of 24 (the
// server's real hard cap on ProductCatalog/List — confirmed 2026-07-15 that
// Take is silently capped at 24 no matter what's requested), fetched with
// concurrency for speed. See catalogService.fetchEntireStoreCatalog for why
// this has to paginate rather than trust a single large Take, and why a
// global full-text search (Items/List ContainsText) can't reliably replace
// this — its result ordering has no awareness of which company stocks what.
//
// A store's real catalog can run into the thousands, so this can take a
// while on first load — exposes `loadedCount` (updated as pages come in)
// so the UI can show visible progress instead of a plain spinner.

import { useQuery }      from '@tanstack/react-query';
import { useSelector }   from 'react-redux';
import { useCallback, useRef, useState } from 'react';

import { QUERY_KEYS }     from '@/constants/queryKeys';
import APP_CONFIG         from '@/constants/appConfig';
import { getAllProducts } from '@/services/catalogService';

const selectIsAuthenticated = (state) => state.auth.isAuthenticated;

/**
 * @param {number|null} storeId - The store to scope the catalog to.
 *   Defaults to the Redux activeStoreId when not provided.
 *   Pass an explicit storeId to support the local catalog store switcher.
 * @param {{ enabled?: boolean }} [options] - `enabled` defaults to true; pass
 *   false to defer the fetch (e.g. until the caller actually needs search),
 *   since this can fire hundreds of requests for a large store.
 */
export function useAllCatalog(storeId, { enabled = true } = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const [loadedCount, setLoadedCount] = useState(0);
  const storeIdRef = useRef(storeId);

  const queryFn = useCallback(() => {
    // Reset the counter for a fresh fetch (new store, or refetch)
    if (storeIdRef.current !== storeId) {
      storeIdRef.current = storeId;
    }
    setLoadedCount(0);
    return getAllProducts(storeId, setLoadedCount);
  }, [storeId]);

  const query = useQuery({
    queryKey:  QUERY_KEYS.CATALOG.ALL(storeId),
    queryFn,
    enabled:   isAuthenticated && !!storeId && enabled,
    // This fetch pages through the store's ENTIRE catalog (up to hundreds of
    // requests — see fetchEntireStoreCatalog) — it's the single most
    // expensive query in the app. STALE_TIME.STOCK (1 min) was wrong here:
    // combined with the global refetchOnWindowFocus, it meant switching
    // browser tabs/apps and back after a minute re-triggered a full
    // catalog re-fetch. A store's catalog doesn't meaningfully change
    // minute-to-minute, so this uses STALE_TIME.CATALOG (5 min) instead.
    staleTime: APP_CONFIG.STALE_TIME.CATALOG,
  });

  return { ...query, loadedCount };
}
