// src/lib/queryPersister.js
//
// Persists a DELIBERATELY NARROW slice of the query cache to IndexedDB
// (via idb-keyval) so it survives a full page reload / browser restart,
// not just in-session navigation — added 2026-08-23 because the catalog
// list alone can page through a store's ENTIRE inventory (hundreds of
// requests, see catalogService.fetchEntireStoreCatalog) and every Shopify
// product image is its own network call; without persistence, ANY reload
// throws all of that away and the operator sits through the full load again.
//
// SCOPE — persisted queries, and why these ONLY:
//   ['catalog', 'products', params]          — the actual catalog/category
//                                               grid (useCatalogProducts,
//                                               an infinite query keyed by
//                                               store+category+out-of-stock
//                                               filter combo — this is the
//                                               one that reloads on every
//                                               catalog visit / category
//                                               switch the ask was about)
//   ['catalog', 'all', storeId]              — the whole-store search index
//                                               (useAllCatalog, deferred
//                                               until the operator actually
//                                               searches)
//   ['shopify', 'product-images', ...]       — per-item Shopify photos
//                                               (product detail page only —
//                                               the catalog grid's photos
//                                               come from OrnaVerse fields
//                                               already embedded in the
//                                               'catalog','products' rows
//                                               above, no separate fetch)
// CORRECTION (2026-08-23, same day): this originally targeted only
// ['catalog','all'], on the mistaken assumption it powered the default
// catalog grid. Live-verified via a temporary debug log that it does not —
// useAllCatalog is disabled until a search happens, so its query sits
// 'pending' forever on an ordinary browsing visit and nothing was ever
// actually being persisted. The default grid + category filtering is
// useCatalogProducts (['catalog','products']), added above after tracing
// catalog/page.jsx's actual data flow.
// All of these are "master data": name, SKU, weight, karat, image URLs —
// things that
// only change when someone edits a product in OrnaVerse/Shopify, not
// something that needs to be correct to the minute. 24h is a safe window for
// a customer to see a slightly-stale product name or photo; it is NOT a safe
// window for a PRICE, which is why nothing price-related is anywhere on this
// list — see hooks/catalog/usePricingEpoch.js, which already keeps prices
// fast AND always-correct via a live change-detector instead of a timer, and
// is completely untouched by this file. shouldDehydrateQuery below is an
// ALLOW-list, not a block-list — a new query type is excluded by default
// unless explicitly added here, so this can't silently start persisting
// something sensitive (price, stock, cart, customer data) just because a
// future hook happens to get added elsewhere in the app.
//
// STORAGE — IndexedDB (idb-keyval), not localStorage: a full store catalog
// in the thousands of items plus their image URLs comfortably exceeds
// localStorage's ~5-10MB quota (and localStorage's synchronous API blocks
// the main thread on read/write at that size); IndexedDB's quota is far
// larger and its API is async by default, which is what
// createAsyncStoragePersister expects.

import { get, set, del } from 'idb-keyval';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

const IDB_KEY = 'lucira-pos-query-cache';

// createAsyncStoragePersister wants a localStorage-shaped API
// (getItem/setItem/removeItem returning promises) — idb-keyval's get/set/del
// already return promises, just under different names.
const idbStorage = {
  getItem: (key) => get(key),
  setItem: (key, value) => set(key, value),
  removeItem: (key) => del(key),
};

export const queryPersister = createAsyncStoragePersister({
  storage: idbStorage,
  key: IDB_KEY,
  // createAsyncStoragePersister does NOT read a `buster` option — it isn't
  // in its destructured param list, so one passed here is silently dropped.
  // The real buster lives in PERSIST_BUSTER below, passed to
  // PersistQueryClientProvider's top-level persistOptions instead (that's
  // what persistQueryClientSave/Restore actually read it from) — found via
  // a live IndexedDB dump that showed "buster":"" even after setting one
  // here.
});

// One day — matches what was asked for ("24 hours... daily the new data
// can be fetched"). Passed to persistQueryClient's `maxAge`; each
// persisted query's own gcTime must be at least this long too (set on
// useAllCatalog/useShopifyProductImages directly) or TanStack drops it
// from the in-memory cache before there's anything left to persist.
export const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;

// Bump this string (not a date — a date would defeat the whole 24h window
// by invalidating everything daily on its own) if the cached shape of a
// persisted query ever changes incompatibly. Passed to
// PersistQueryClientProvider's persistOptions.buster.
export const PERSIST_BUSTER = 'v1';

const PERSISTED_QUERY_KEY_PREFIXES = [
  ['catalog', 'products'],
  ['catalog', 'all'],
  ['shopify', 'product-images'],
];

function matchesPrefix(queryKey, prefix) {
  return prefix.every((segment, i) => queryKey[i] === segment);
}

/**
 * ALLOW-list predicate for persistQueryClientSave's dehydrateOptions.
 * Only successful queries are ever considered — an in-flight, disabled, or
 * errored query has nothing useful to restore on next load (a DISABLED
 * query — e.g. useAllCatalog before a search happens — sits at status
 * 'pending' forever and must not be mistaken for "still loading, try again
 * shortly"; see the correction note above this file's header for the real
 * bug this distinction fixed).
 */
export function shouldPersistQuery(query) {
  if (query.state.status !== 'success') return false;
  return PERSISTED_QUERY_KEY_PREFIXES.some((prefix) => matchesPrefix(query.queryKey, prefix));
}
