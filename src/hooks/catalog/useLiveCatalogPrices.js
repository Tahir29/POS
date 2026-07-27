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

const DEBOUNCE_MS   = 200;
const CHUNK_SIZE     = 24; // matches ProductCatalog/List's real per-request cap
const CONCURRENCY    = 3;

async function fetchInChunks(ids, onChunkResolved) {
  const chunks = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) chunks.push(ids.slice(i, i + CHUNK_SIZE));

  let cursor = 0;
  async function worker() {
    while (cursor < chunks.length) {
      const chunk = chunks[cursor++];
      const result = await getLivePricesForItems(chunk);
      onChunkResolved(chunk, result);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker)
  );
}

/**
 * @param {object[]} products — current display list (ProductCatalogRow[]),
 *   `price` may be null for items still needing the live-pricing tier.
 * @returns {Map<number, number>} item_id -> live price, filled in over time.
 */
export function useLiveCatalogPrices(products) {
  const [priceById, setPriceById] = useState(() => new Map());
  const resolvedRef = useRef(new Set()); // item_ids already settled (priced or confirmed unpriceable)
  const pendingRef  = useRef(new Set()); // item_ids queued/in-flight for the next batch
  const timerRef    = useRef(null);

  const idsNeeding = useMemo(
    () => products
      .filter((p) => p.price == null && p.item_id != null)
      .map((p) => p.item_id),
    [products]
  );

  useEffect(() => {
    const fresh = idsNeeding.filter(
      (id) => !resolvedRef.current.has(id) && !pendingRef.current.has(id)
    );
    if (!fresh.length) return;

    fresh.forEach((id) => pendingRef.current.add(id));

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const idsToFetch = [...pendingRef.current];
      fetchInChunks(idsToFetch, (chunkIds, result) => {
        setPriceById((prev) => {
          const next = new Map(prev);
          for (const id of chunkIds) {
            resolvedRef.current.add(id);
            pendingRef.current.delete(id);
            if (result.has(id)) next.set(id, result.get(id));
          }
          return next;
        });
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timerRef.current);
  }, [idsNeeding]);

  return priceById;
}
