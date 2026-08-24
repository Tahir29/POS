// src/hooks/catalog/useLiveCatalogPrices.js
//
// Background live-price fill-in for catalog products. Prices come from
// Services/Helpers/SetSalesItems — confirmed live 2026-07-28 to take 6-7+
// seconds per ~15-item batch — so catalogService's getProducts/getAllProducts
// deliberately do NOT await it inline (see the PRICING note in
// catalogService.js). This hook fills prices in out-of-band so pages render
// immediately and prices arrive a moment later.
//
// CACHING (2026-08-07). This used to hold every price in component-local
// useState/useRef. That meant leaving /catalog destroyed the lot: coming back
// remounted with an empty Map and re-ran the entire 6-7s pipeline for items
// already priced seconds earlier. Prices now live in the TanStack cache under
// one key per item, so a return visit paints from cache instantly and only
// genuinely-new item_ids hit the network.
//
// STAYING CORRECT WHEN A PRICE ACTUALLY MOVES. Caching a price is only safe
// if a changed price still reaches the screen. Two mechanisms, both needed:
//
//   1. The pricing EPOCH, which is part of every key here. It is a fingerprint
//      of what a couple of canary items currently cost — see usePricingEpoch.
//      While it holds, no input to any price has moved and every cached price
//      is still correct, so prices are cached with `staleTime: Infinity` and
//      re-read for free however long the operator has been away. When a canary
//      moves, the epoch changes, every key below it changes with it, and the
//      catalog reprices. Detection costs one small call; the 6-7s sweep only
//      happens when a price genuinely changed.
//   2. Explicit invalidation. Saving a metal rate in Settings invalidates the
//      epoch so it re-checks at once (see useAddMetalRate) rather than waiting
//      out its one-minute floor. This is a convenience, not the mechanism —
//      rates are normally set in OrnaVerse's ERP, where no in-app invalidation
//      can see them, and (1) is what covers that.
//
// SCOPE: this is an in-memory cache. It survives navigating away and back,
// which is the reported problem; a full browser reload starts empty.
//
// BATCHING IS PRESERVED. Per-item cache keys must not become per-item network
// calls. Each item's queryFn enqueues into a module-level batcher that
// coalesces ids over a short window, then fetches them in chunks with limited
// concurrency — one SetSalesItems call per CHUNK_SIZE items, exactly as
// before. Every item's promise settles from its own chunk, so prices still
// fill in progressively rather than a page at a time.

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getLivePricesForItems } from '@/services/catalogService';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { usePricingEpoch } from '@/hooks/catalog/usePricingEpoch';

const DEBOUNCE_MS = 200;
// Smaller than ProductCatalog/List's 24-row page on purpose: EVERY item needs
// live pricing (the stored item_rate was retired — see the PRICING note in
// catalogService.js), and SetSalesItems takes 6-7+ seconds per ~15 full master
// records. Smaller batches return sooner, fail smaller, and let prices appear
// progressively instead of a page at a time.
const CHUNK_SIZE  = 8;
const CONCURRENCY = 3;
// An item is retried only if the server never answered for it (network/500).
// A priced-at-0 verdict is final, so this bounds real failures only.
const MAX_ATTEMPTS = 3;

// How long an unobserved price survives in memory. Leaving /catalog drops
// every observer, so this — not staleTime, which is Infinity — is what decides
// whether a return visit still finds its prices. Sized to outlast a shift: a
// price is one number per item, so holding a catalog's worth costs nothing,
// and expiring them early would reintroduce the exact 6-7s refetch-on-return
// this hook exists to stop. Correctness does not depend on it; the epoch
// handles that.
const PRICE_GC_TIME = 12 * 60 * 60 * 1000; // 12h

// Only used when the epoch is blind (see usePricingEpoch). Long enough to
// still spare the operator the 6-7s sweep on ordinary navigation, short
// enough that a store the detector cannot see into still self-corrects.
const BLIND_FALLBACK_STALE = 60 * 60 * 1000; // 1h

// Hard ceiling on how many items we will price at once.
//
// displayProducts is `searchResults` in search mode, and a name search can
// match thousands of rows on a large store. Pricing all of them would open
// thousands of query observers and hammer SetSalesItems for many minutes on
// results nobody is reading — the previous implementation had that same
// unbounded exposure via its pending set. Ten pages' worth covers any
// realistic amount of scrolling; past that the operator should narrow the
// search. Items beyond the window keep reading "Pricing…" rather than being
// asserted unpriceable, because we genuinely have not asked.
const PRICE_WINDOW = 240;

// One bucket per store: the price of an item depends on which physical piece
// that store holds, so ids for different stores must never share a batch.

const buckets = new Map(); // storeId -> { waiters: Map<itemId, deferred[]>, timer }

function getBucket(storeId) {
  let bucket = buckets.get(storeId);
  if (!bucket) {
    bucket = { waiters: new Map(), timer: null };
    buckets.set(storeId, bucket);
  }
  return bucket;
}

/**
 * Queue one item for pricing and get a promise for its result.
 * Resolves to a number (priced), or null (the server answered but priced it
 * at 0 — a real "cannot be sold" verdict, currently every Silver925 item).
 * Rejects only when the server never reached a verdict, so TanStack's retry
 * covers transient failures without re-asking about settled items.
 */
function enqueuePrice(itemId, storeId) {
  return new Promise((resolve, reject) => {
    const bucket = getBucket(storeId);
    const existing = bucket.waiters.get(itemId);
    if (existing) existing.push({ resolve, reject });
    else bucket.waiters.set(itemId, [{ resolve, reject }]);

    // A LEADING window, not a trailing debounce: the first id starts the
    // clock and everything arriving within it joins the same batch. A
    // trailing timer would reset on every new id, so continuous scrolling
    // could starve the batch and never fire at all.
    if (!bucket.timer) {
      bucket.timer = setTimeout(() => flush(storeId), DEBOUNCE_MS);
    }
  });
}

async function flush(storeId) {
  const bucket = getBucket(storeId);
  bucket.timer = null;

  const waiters = bucket.waiters;
  bucket.waiters = new Map(); // ids arriving from here on start the next batch
  if (!waiters.size) return;

  const ids = [...waiters.keys()];
  const chunks = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) chunks.push(ids.slice(i, i + CHUNK_SIZE));

  const settle = (id, fn) => (waiters.get(id) ?? []).forEach(fn);

  let cursor = 0;
  async function worker() {
    while (cursor < chunks.length) {
      const chunk = chunks[cursor++];
      try {
        const { prices, answered } = await getLivePricesForItems(chunk, storeId);
        for (const id of chunk) {
          if (answered.has(id)) {
            // Settled for good — a price, or a confirmed unpriceable verdict.
            const value = prices.get(id) ?? null;
            settle(id, (w) => w.resolve(value));
          } else {
            // No verdict reached. Reject so TanStack retries this item
            // instead of caching a permanent blank, which is what left a
            // whole page unpriced after one transient 500.
            settle(id, (w) => w.reject(new Error(`No price verdict for item ${id}`)));
          }
        }
      } catch (err) {
        // getLivePricesForItems swallows its own errors, so this is
        // defensive — but an unpriced chunk must never leave promises hanging.
        for (const id of chunk) settle(id, (w) => w.reject(err));
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker)
  );
}

/**
 * @param {object[]} products — current display list (ProductCatalogRow[]),
 *   `price` may be null for items still needing the live-pricing tier.
 * @param {number|null} [storeIdOverride] — price against THIS store instead
 *   of the Redux global active store. The catalog page's own store filter
 *   (catalogStoreId) lets an operator browse a store other than the one
 *   they're signed into, and pricing MUST follow that same store, not the
 *   signed-in one — a price is which physical piece a store actually holds
 *   (see getLivePricesForItems), so pricing against the wrong store silently
 *   quotes a DIFFERENT piece than the one on screen. Confirmed live
 *   2026-08-24: switching the catalog's store filter correctly re-fetched
 *   the product list from the new store, but every SetSalesItems call still
 *   carried the old (signed-in) store's company_id and priced its stock
 *   journal entries — e.g. "HO-TGI-11-25-77" — while browsing a completely
 *   different store's catalog. Callers without a filter of their own
 *   (RecentlyViewedCarousel, the customer profile's Wishlist tab) omit this
 *   and keep pricing against the signed-in store, same as before.
 * @returns {{
 *   priceById:  Map<number, number>,  // item_id -> live price
 *   settledIds: Set<number>,          // server has given a verdict (priced or not)
 * }}
 *   Callers need both: a card with no price is "Pricing…" until its id is
 *   settled, and "Price unavailable" after.
 */
export function useLiveCatalogPrices(products, storeIdOverride) {
  // The store decides WHICH physical piece a card is priced against, so a
  // price is only meaningful alongside it. See getLivePricesForItems.
  const activeStoreId = useSelector(selectActiveStoreId);
  const storeId = storeIdOverride ?? activeStoreId;

  const idsNeeding = useMemo(() => {
    const seen = new Set();
    for (const p of products) {
      if (p.price != null || p.item_id == null) continue;
      seen.add(p.item_id);
      if (seen.size >= PRICE_WINDOW) break;
    }
    return [...seen];
  }, [products]);

  // Gates the queries below: until the first canary result lands there is no
  // epoch to key against, and fetching now would cache every price under a
  // key that is about to change — paying the 6-7s sweep twice on first load.
  const { epoch, isBlind } = usePricingEpoch(products, storeId);

  const results = useQueries({
    queries: idsNeeding.map((itemId) => ({
      queryKey: QUERY_KEYS.CATALOG.PRICE(itemId, storeId, epoch),
      queryFn:  () => enqueuePrice(itemId, storeId),
      enabled:  epoch != null,
      // Cached until the epoch says otherwise, never on a timer — the whole
      // point of the epoch. The exception is a BLIND epoch (every canary
      // prices at 0, so it can never signal movement): caching forever on a
      // signal that cannot fire would pin the catalog to stale prices, so
      // that case degrades to a plain time window instead.
      staleTime: isBlind ? BLIND_FALLBACK_STALE : Infinity,
      gcTime:    PRICE_GC_TIME,
      retry:     MAX_ATTEMPTS - 1, // attempts = 1 initial + retries
    })),
  });

  // useQueries hands back a fresh array every render, so derive a cheap
  // signature and rebuild the Map/Set only when a verdict actually changed.
  // The catalog page memoizes on these two identities — rebuilding them
  // every render would bust that memo across the whole grid.
  const signature = results
    .map((r, i) => `${idsNeeding[i]}:${r.status}:${r.data ?? ''}`)
    .join('|');

  return useMemo(() => {
    const priceById  = new Map();
    const settledIds = new Set();

    results.forEach((r, i) => {
      const id = idsNeeding[i];
      if (id == null) return;
      if (r.isSuccess) {
        settledIds.add(id);
        if (r.data != null) priceById.set(id, r.data);
      } else if (r.isError) {
        // Retries exhausted. Previously these stayed out of settledIds and
        // the card read "Pricing…" forever, promising a number that was
        // never coming. An item we've asked about three times and failed to
        // price is unavailable, and should say so.
        settledIds.add(id);
      }
    });

    return { priceById, settledIds };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}
