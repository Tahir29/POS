// src/hooks/catalog/usePricingEpoch.js
//
// A change-detector for catalog prices, so they can be cached INDEFINITELY
// instead of on a timer.
//
// THE PROBLEM. Pricing a catalog card costs 6-7s per ~15 items
// (Helpers/SetSalesItems, confirmed live 2026-07-28), so prices have to be
// cached. But a cached price is only safe while it is still the right price,
// and this app has no push channel to tell it a price moved. A time window
// (`staleTime: 12h`) is the usual answer, and it is a poor one here: it
// re-prices the whole catalog on a schedule whether or not anything changed,
// and still shows a wrong price for up to a window's length when something did.
//
// THE SIGNAL. Rather than guess from the clock, ask. Re-price a couple of
// CANARY items — one small call — and use their price as a fingerprint of the
// pricing inputs. If the canaries come back at the same figure, nothing that
// affects a price has moved and every cached price in the catalog is still
// good. If a canary moved, something upstream changed and the whole catalog
// is repriced.
//
// This is deliberately NOT "read the metal rate and compare". Two reasons:
//   • Nothing here reliably returns the current rate. CheckMetalRateForToday
//     is a "has today's rate been entered" boolean — note useAuth reads it as
//     `is_set ?? Entity?.is_set ?? true`, three guesses and a default, so its
//     shape was never actually confirmed. Helpers/GetRate is unwired and 500s
//     on a bare { item_id }.
//   • The metal rate is not the only input. Making charges, wastage and stone
//     rates all move a price without moving the rate. A canary priced through
//     the real SetSalesItems path notices all of them, because it IS the path
//     the catalog prices through.
//
// It also works when the rate is set directly in OrnaVerse's ERP or on another
// terminal, which no in-app invalidation can see.
//
// WHEN IT CHECKS: on landing on /catalog and on window refocus (both floored
// to once a minute), and on a timer while the page stays open — see
// EPOCH_POLL_MS, which is what covers an operator parked on the catalog
// scrolling stock without ever navigating.
//
// COST: one ~1s call per check, running in the BACKGROUND while cached prices
// are already on screen. In exchange the 6-7s sweep happens only when a price
// genuinely moved.

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getLivePricesForItems } from '@/services/catalogService';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

// One canary per karat, capped. Karat is the finest-grained metal dimension a
// ProductCatalogRow carries (there is no metal_type field), and it is what a
// metal rate actually applies through — so a canary per karat catches a rate
// that moved for 22K but not 14K. Three is enough to cover a store's usual
// spread while keeping this to one small call.
const MAX_CANARIES = 3;

// Floor on how often the canary is re-checked. This is NOT a staleness window
// on prices — those never expire on time. It only stops catalog→product→
// catalog bouncing from firing a detector call on every single return.
const EPOCH_CHECK_FLOOR = APP_CONFIG.STALE_TIME.STOCK; // 1 min

// Poll the canary on a timer as well as on mount/focus.
//
// Without this, detection is purely event-driven — and the commonest way this
// POS is used is an operator parked on /catalog scrolling stock, never
// navigating and never leaving the window. Nothing would remount, nothing
// would refocus, and a rate changed in OrnaVerse would go unnoticed for as
// long as they stayed put. The timer is what closes that.
//
// It only runs while /catalog is mounted, since that is the only thing that
// observes this query — leave the page and the polling stops with it. And
// `refetchIntervalInBackground` is left at its default of false, so a
// backgrounded tab is not polled either; refetchOnWindowFocus covers the
// return. So the cost is one small call every few minutes, and only while
// someone is actually looking at the catalog.
const EPOCH_POLL_MS = 3 * 60 * 1000; // 3 min

// Used only when the canary itself cannot be priced (see below). Prices still
// cache under it, so a broken detector degrades to "cache and don't re-check"
// rather than "never show a price".
const NO_EPOCH = 'no-epoch';

// The canary set must be IDENTICAL on every visit — a different set would
// produce a different fingerprint and read as a price movement. So it is
// frozen per store on first sight and never recomputed. Module scope, so it
// survives navigation the same way the query cache does (and is discarded on
// reload the same way, which is correct: a reload re-derives it).
const canaryByStore = new Map(); // storeId -> number[]

function freezeCanaries(storeId, products) {
  if (storeId == null) return null;
  const existing = canaryByStore.get(storeId);
  if (existing) return existing;
  if (!products?.length) return null; // still loading — try again next render

  const usable = products.filter((p) => p.item_id != null);

  // A karat-less item can never be priced — Items/List omits records with no
  // weight/karat/metal, so getLivePricesForItems answers them at 0 forever
  // (see its `returnedIds` handling). They would burn a canary slot on a
  // reading that can never move, so they are only used if nothing else exists.
  const withKarat = usable.filter((p) => p.karat_id != null);
  const pool = withKarat.length ? withKarat : usable;

  // Prefer items the shelf actually holds: getLivePricesForItems prices the
  // physical piece when there is one and the master otherwise, and a canary
  // should travel the same path as the cards it vouches for.
  const ranked = [...pool].sort((a, b) =>
    (b.has_stock ? 1 : 0) - (a.has_stock ? 1 : 0) || a.item_id - b.item_id
  );

  const byKarat = new Map();
  for (const p of ranked) {
    const karat = p.karat_id ?? 'unknown';
    if (!byKarat.has(karat)) byKarat.set(karat, p.item_id);
    if (byKarat.size >= MAX_CANARIES) break;
  }
  if (!byKarat.size) return null;

  const ids = [...byKarat.values()].sort((a, b) => a - b);
  canaryByStore.set(storeId, ids);
  return ids;
}

/**
 * A canary priced at 0 is a real verdict, but it is a CONSTANT one — it reads
 * 0 today and 0 after any rate change, so it can never signal movement. On a
 * store whose canaries all price 0 (Silver925 prices at 0 on this tenant, in
 * OrnaVerse's own POS too) the detector is blind, and caching forever on a
 * signal that cannot fire would quietly pin the catalog to stale prices.
 * Callers fall back to a time window when this is true.
 */
function isBlindEpoch(epoch) {
  if (!epoch || epoch === NO_EPOCH) return true;
  return epoch.split('|').every((part) => Number(part.split(':')[1]) === 0);
}

/**
 * @param {object[]} products — current display list, used once per store to
 *   choose the canaries. Later changes to it are ignored on purpose.
 * @returns {{ epoch: string|undefined, isBlind: boolean }}
 *   `epoch` is undefined until the first canary result lands — callers MUST
 *   NOT fetch prices before then, or those prices would be cached under a key
 *   that is about to change and be refetched immediately.
 *   `isBlind` means the epoch cannot detect change and must not be trusted as
 *   a licence to cache indefinitely.
 */
export function usePricingEpoch(products) {
  const storeId = useSelector(selectActiveStoreId);
  const queryClient = useQueryClient();

  const canaryIds = useMemo(
    () => freezeCanaries(storeId, products),
    [storeId, products]
  );

  const { data, isError } = useQuery({
    queryKey: QUERY_KEYS.CATALOG.PRICE_EPOCH(storeId, canaryIds ?? []),
    queryFn: async () => {
      const { prices, answered } = await getLivePricesForItems(canaryIds, storeId);

      // Every canary must reach a verdict. A partial answer would produce a
      // DIFFERENT fingerprint from a complete one, and a transient 500 would
      // then masquerade as a price change and reprice the entire catalog.
      // Throwing instead keeps the last good epoch in place — on error
      // TanStack serves the previous data, so cached prices stay valid.
      const missing = canaryIds.filter((id) => !answered.has(id));
      if (missing.length) {
        throw new Error(`canary re-price reached no verdict for ${missing.join(', ')}`);
      }

      // A canary priced at 0 is a real verdict ("cannot be sold" — currently
      // every Silver925 item), so it belongs in the fingerprint as 0 rather
      // than being treated as a failure.
      return canaryIds.map((id) => `${id}:${prices.get(id) ?? 0}`).join('|');
    },
    enabled:   Boolean(storeId && canaryIds?.length),
    staleTime: EPOCH_CHECK_FLOOR,
    // The detector's real cadence when nobody navigates — see EPOCH_POLL_MS.
    refetchInterval: EPOCH_POLL_MS,
    // Never collected: losing the epoch would strand every price cached under
    // it, which is the whole thing this exists to prevent.
    gcTime:    Infinity,
    retry:     2,
  });

  // If the canaries can't be priced at all and we have no previous epoch to
  // fall back on, don't hold the catalog hostage to a broken detector — fall
  // through to a fixed epoch so prices load and cache as normal. When the
  // canary later succeeds the epoch changes and the catalog reprices once.
  const epoch = data ?? (isError ? NO_EPOCH : undefined);

  // A new epoch makes every price cached under the old one unreachable. Drop
  // them rather than letting them sit until gcTime — otherwise a store that
  // repriced a few times would keep several dead copies of the catalog.
  useEffect(() => {
    if (!epoch) return;
    queryClient.removeQueries({
      queryKey: ['catalog', 'price'],
      predicate: (query) => query.queryKey[4] !== epoch,
    });
  }, [epoch, queryClient]);

  return { epoch, isBlind: isBlindEpoch(epoch) };
}
