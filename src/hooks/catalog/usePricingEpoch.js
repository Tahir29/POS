// A change-detector for catalog prices, so they can be cached indefinitely
// instead of on a timer. Pricing a catalog card is expensive
// (Helpers/SetSalesItems, ~6-7s per ~15 items), so prices must be cached —
// but a cached price is only safe while it's still correct, and there is no
// push channel to signal a price moved.
//
// Instead of a time window, this re-prices a couple of CANARY items (one
// small call) and uses their price as a fingerprint of the pricing inputs.
// If the canaries come back unchanged, every cached price in the catalog is
// still good; if a canary moved, something upstream changed and the whole
// catalog reprices. This is deliberately not "read the metal rate and
// compare": nothing in the API reliably exposes the current rate
// (CheckMetalRateForToday is only a has-today's-rate-been-entered boolean;
// Helpers/GetRate is unwired), and the rate isn't the only input anyway —
// making charges, wastage and stone rates all move a price too. A canary
// priced through the real SetSalesItems path notices all of them, and also
// catches a rate changed directly in OrnaVerse's ERP or another terminal,
// which no in-app invalidation can see.
//
// Checked on landing on /catalog, on window refocus (both floored to once a
// minute), and on a timer while the page stays open (EPOCH_POLL_MS) so an
// operator parked on the catalog without navigating still gets it.

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getLivePricesForItems } from '@/services/catalogService';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

// One canary per karat, capped — karat is the finest-grained metal dimension
// a ProductCatalogRow carries (no metal_type field), and it's what a metal
// rate applies through, so this catches a rate that moved for 22K but not 14K.
const MAX_CANARIES = 3;

// Floor on how often the canary is re-checked (not a staleness window on
// prices themselves — those never expire on time). Just stops catalog↔product
// bouncing from firing a detector call on every return.
const EPOCH_CHECK_FLOOR = APP_CONFIG.STALE_TIME.STOCK; // 1 min

// Poll the canary on a timer too, so an operator parked on /catalog without
// navigating or refocusing still detects a rate change in OrnaVerse. Only
// runs while /catalog is mounted; refetchIntervalInBackground stays false so
// a backgrounded tab isn't polled (refetchOnWindowFocus covers the return).
const EPOCH_POLL_MS = 3 * 60 * 1000; // 3 min

// Used only when the canary itself cannot be priced. Prices still cache
// under it, so a broken detector degrades to "cache and don't re-check"
// rather than "never show a price".
const NO_EPOCH = 'no-epoch';

// The canary set must be IDENTICAL on every visit (a different set would
// misread as a price movement), so it's frozen per store on first sight.
// Module scope: survives navigation like the query cache, discarded on
// reload like the query cache too.
const canaryByStore = new Map(); // storeId -> number[]

function freezeCanaries(storeId, products) {
  if (storeId == null) return null;
  const existing = canaryByStore.get(storeId);
  if (existing) return existing;
  if (!products?.length) return null; // still loading — try again next render

  const usable = products.filter((p) => p.item_id != null);

  // A karat-less item can never be priced (getLivePricesForItems answers it
  // at 0 forever), so it would burn a canary slot on a reading that can never
  // move — only used as a last resort.
  const withKarat = usable.filter((p) => p.karat_id != null);
  const pool = withKarat.length ? withKarat : usable;

  // Prefer items the shelf actually holds, so a canary travels the same
  // pricing path (physical piece vs. master) as the cards it vouches for.
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
 * A canary priced at 0 is a real but CONSTANT verdict (0 today, 0 after any
 * rate change), so it can never signal movement. On a store whose canaries
 * all price 0 (e.g. Silver925 on this tenant) the detector is blind — callers
 * fall back to a time window when this is true.
 */
function isBlindEpoch(epoch) {
  if (!epoch || epoch === NO_EPOCH) return true;
  return epoch.split('|').every((part) => Number(part.split(':')[1]) === 0);
}

/**
 * @param {object[]} products — current display list, used once per store to
 *   choose the canaries. Later changes to it are ignored on purpose.
 * @param {number|null} [storeIdOverride] — prices the canaries against THIS
 *   store instead of the Redux global active store — see useLiveCatalogPrices
 *   for why this must follow the store actually being browsed.
 * @returns {{ epoch: string|undefined, isBlind: boolean }}
 *   `epoch` is undefined until the first canary result lands — callers MUST
 *   NOT fetch prices before then, or those prices would be cached under a key
 *   that is about to change and be refetched immediately.
 *   `isBlind` means the epoch cannot detect change and must not be trusted as
 *   a licence to cache indefinitely.
 */
export function usePricingEpoch(products, storeIdOverride) {
  const activeStoreId = useSelector(selectActiveStoreId);
  const storeId = storeIdOverride ?? activeStoreId;
  const queryClient = useQueryClient();

  const canaryIds = useMemo(
    () => freezeCanaries(storeId, products),
    [storeId, products]
  );

  const { data, isError } = useQuery({
    queryKey: QUERY_KEYS.CATALOG.PRICE_EPOCH(storeId, canaryIds ?? []),
    queryFn: async () => {
      const { prices, answered } = await getLivePricesForItems(canaryIds, storeId);

      // Every canary must reach a verdict — a partial answer would produce a
      // different fingerprint and a transient 500 would masquerade as a price
      // change. Throwing keeps the last good epoch in place (TanStack serves
      // previous data on error).
      const missing = canaryIds.filter((id) => !answered.has(id));
      if (missing.length) {
        throw new Error(`canary re-price reached no verdict for ${missing.join(', ')}`);
      }

      // A canary priced at 0 is a real verdict ("cannot be sold"), so it
      // belongs in the fingerprint as 0 rather than being treated as a failure.
      return canaryIds.map((id) => `${id}:${prices.get(id) ?? 0}`).join('|');
    },
    enabled:   Boolean(storeId && canaryIds?.length),
    staleTime: EPOCH_CHECK_FLOOR,
    refetchInterval: EPOCH_POLL_MS,
    gcTime:    Infinity, // losing the epoch would strand every price cached under it
    retry:     2,
  });

  // If the canaries can't be priced at all, don't hold the catalog hostage to
  // a broken detector — fall through to a fixed epoch so prices load and
  // cache as normal; a later successful canary changes the epoch and reprices.
  const epoch = data ?? (isError ? NO_EPOCH : undefined);

  // A new epoch makes prices cached under the old one unreachable — drop
  // them rather than waiting out gcTime, so a store that repriced a few
  // times doesn't keep several dead copies of the catalog.
  useEffect(() => {
    if (!epoch) return;
    queryClient.removeQueries({
      queryKey: ['catalog', 'price'],
      predicate: (query) => query.queryKey[4] !== epoch,
    });
  }, [epoch, queryClient]);

  return { epoch, isBlind: isBlindEpoch(epoch) };
}
