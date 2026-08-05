// src/hooks/catalog/useLiveCatalogPrices.js
//
// Background live-price fill-in for catalog products whose price could only
// come from the slow tier (Services/Helpers/SetSalesItems — confirmed live
// 2026-07-28 to take 6-7+ seconds per ~15-item batch). catalogService's
// getProducts/getAllProducts no longer await this inline (see
// attachStaticPrice/getLivePricesForItems in catalogService.js) — this hook
// does it out-of-band so pages render immediately and BOM items' prices
// arrive a moment later instead of blocking the whole page/scroll.
//
// Debounced + chunked: rapid scrolling can accumulate many pages' worth of
// unpriced item_ids before the user settles, so a single trailing timer
// coalesces them into one batch — then that batch is split into page-sized
// chunks fetched with limited concurrency, updating state as each chunk
// resolves (progressive fill-in) rather than waiting on the whole set.

import { useEffect, useMemo, useRef, useState } from 'react';
import { getLivePricesForItems } from '@/services/catalogService';

const DEBOUNCE_MS = 200;
// Smaller than ProductCatalog/List's 24-row page on purpose: EVERY item now
// needs live pricing (the stored item_rate was retired — see the PRICING note
// in catalogService.js), and SetSalesItems takes 6-7+ seconds per ~15 full
// master records. Smaller batches return sooner, fail smaller, and let prices
// appear progressively instead of a page at a time.
const CHUNK_SIZE  = 8;
const CONCURRENCY = 3;
// An item is retried only if the server never answered for it (network/500).
// A priced-at-0 verdict is final, so this cap only bounds real failures.
const MAX_ATTEMPTS = 3;

async function fetchInChunks(ids, onChunkResolved) {
  const chunks = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) chunks.push(ids.slice(i, i + CHUNK_SIZE));

  let cursor = 0;
  async function worker() {
    while (cursor < chunks.length) {
      const chunk = chunks[cursor++];
      const { prices, answered } = await getLivePricesForItems(chunk);
      onChunkResolved(chunk, prices, answered);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker)
  );
}

/**
 * @param {object[]} products — current display list (ProductCatalogRow[]),
 *   `price` may be null for items still needing the live-pricing tier.
 * @returns {{
 *   priceById:  Map<number, number>,  // item_id -> live price
 *   settledIds: Set<number>,          // server has given a verdict (priced or not)
 * }}
 *   Callers need both: a card with no price is "Pricing…" until its id is
 *   settled, and "Price unavailable" after.
 */
export function useLiveCatalogPrices(products) {
  const [priceById, setPriceById] = useState(() => new Map());
  // Mirrors resolvedRef as STATE so a verdict re-renders the cards — a ref
  // alone would leave "Pricing…" on screen forever for unpriceable items.
  const [settledIds, setSettledIds] = useState(() => new Set());
  const resolvedRef = useRef(new Set()); // item_ids the server answered for (priced or confirmed unpriceable)
  const pendingRef  = useRef(new Set()); // item_ids queued/in-flight for the next batch
  const attemptsRef = useRef(new Map()); // item_id -> failed attempts, for bounded retry
  const timerRef    = useRef(null);

  const idsNeeding = useMemo(
    () => products
      .filter((p) => p.price == null && p.item_id != null)
      .map((p) => p.item_id),
    [products]
  );

  useEffect(() => {
    const fresh = idsNeeding.filter(
      (id) => !resolvedRef.current.has(id)
        && !pendingRef.current.has(id)
        && (attemptsRef.current.get(id) ?? 0) < MAX_ATTEMPTS
    );
    if (!fresh.length) return;

    fresh.forEach((id) => pendingRef.current.add(id));

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const idsToFetch = [...pendingRef.current];
      fetchInChunks(idsToFetch, (chunkIds, prices, answered) => {
        const justSettled = [];
        for (const id of chunkIds) {
          pendingRef.current.delete(id);
          if (answered.has(id)) {
            // Settled for good — either it has a price, or the server
            // priced it at 0 and it genuinely cannot be sold.
            resolvedRef.current.add(id);
            justSettled.push(id);
          } else {
            // The call failed before reaching a verdict. Previously these
            // were marked resolved anyway, so one transient 500 left a
            // whole page permanently blank with no way to recover short of
            // a remount. Count the attempt and let a later render retry.
            attemptsRef.current.set(id, (attemptsRef.current.get(id) ?? 0) + 1);
          }
        }

        setPriceById((prev) => {
          const next = new Map(prev);
          for (const [id, value] of prices) next.set(id, value);
          return next;
        });
        if (justSettled.length) {
          setSettledIds((prev) => {
            const next = new Set(prev);
            for (const id of justSettled) next.add(id);
            return next;
          });
        }
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timerRef.current);
  }, [idsNeeding]);

  return { priceById, settledIds };
}
