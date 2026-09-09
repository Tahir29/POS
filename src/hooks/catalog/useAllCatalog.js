// src/hooks/catalog/useAllCatalog.js
// Fetches the complete (tenant-wide) product catalog, for client-side
// search, filter, and barcode lookup on the catalog page — then narrows it
// to the CALLING store via `select`.
//
// getAllProducts paginates in chunks of 24 (the server's real hard cap on
// ProductCatalog/List — confirmed 2026-07-15 that Take is silently capped
// at 24 no matter what's requested), fetched with concurrency for speed.
// See catalogService.fetchEntireStoreCatalog for why this has to paginate
// rather than trust a single large Take, why a global full-text search
// (Items/List ContainsText) can't reliably replace this, and — the
// important part — why `current_company_id` doesn't actually scope the
// result at all, which is the whole reason this is now a SHARED fetch (see
// below) rather than one per store.
//
// SHARED ACROSS STORES (2026-09-09) — CONFIRMED LIVE: ProductCatalog/List's
// `current_company_id` doesn't restrict the result set at all; the exact
// same ~2,699-item tenant-wide pool comes back regardless of which company
// is passed, just reordered. This used to be cached per store
// (QUERY_KEYS.CATALOG.ALL(storeId)), so switching stores — or even just
// re-searching on the SAME store after clearing, since `hasSearched` in
// catalog/page.jsx never resets once true — could re-run the entire
// ~15-round sweep from scratch even though the identical data was already
// sitting in cache under a different key. Now cached under ONE shared,
// store-agnostic key: the sweep runs at most once per staleTime window,
// EVER, and every store's search reads from that one cached pool, filtered
// to its own items via catalogService.belongsToStore in `select` (react-
// query re-runs `select` per observer/storeId over the SAME cached raw
// data — no extra network calls for a second store to get its own view).
//
// A cold cache can still take a while on its very first run — exposes
// `loadedCount` (updated as pages come in) so the UI can show visible
// progress instead of a plain spinner.

import { useQuery }      from '@tanstack/react-query';
import { useSelector }   from 'react-redux';
import { useCallback, useState } from 'react';

import { QUERY_KEYS }     from '@/constants/queryKeys';
import APP_CONFIG         from '@/constants/appConfig';
import { getAllProducts, belongsToStore } from '@/services/catalogService';

const selectIsAuthenticated = (state) => state.auth.isAuthenticated;

/**
 * @param {number|null} storeId - The store to filter the shared catalog to.
 *   Defaults to the Redux activeStoreId when not provided.
 *   Pass an explicit storeId to support the local catalog store switcher.
 * @param {{ enabled?: boolean }} [options] - `enabled` defaults to true; pass
 *   false to defer the fetch (e.g. until the caller actually needs search).
 */
export function useAllCatalog(storeId, { enabled = true } = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const [loadedCount, setLoadedCount] = useState(0);

  const queryFn = useCallback(() => {
    setLoadedCount(0);
    // `storeId` here only SEEDS the request payload (any real company_id
    // works — see catalogService's own header) since this result is shared
    // across every store; it does not scope what comes back.
    return getAllProducts(storeId, setLoadedCount);
  }, [storeId]);

  const query = useQuery({
    queryKey:  QUERY_KEYS.CATALOG.ALL_SHARED(),
    queryFn,
    select:    useCallback((allProducts) => allProducts.filter((p) => belongsToStore(p, storeId)), [storeId]),
    enabled:   isAuthenticated && !!storeId && enabled,
    staleTime: APP_CONFIG.STALE_TIME.MASTER_DATA,
    gcTime:    APP_CONFIG.STALE_TIME.MASTER_DATA,
  });

  return { ...query, loadedCount };
}
