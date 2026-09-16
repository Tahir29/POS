// src/hooks/products/useSimilarProducts.js
// "Similar Products" for the product detail page — OrnaVerse-only, per
// explicit instruction (no Shopify involved). OrnaVerse's own API has no
// dedicated similar/related-items endpoint (confirmed against their own
// compiled client — no such concept exists there either), so this is built
// entirely from ProductCatalog/List's own classification fields, the exact
// approach OrnaVerse's own POS is understood to have used at one point.
//
// Reuses useAllCatalog's already-cached, store-scoped catalog (the SAME
// data the catalog page's search/filter and RecentlyViewedCarousel already
// share) — one shared sweep, no extra network round trip just to populate
// this shelf. A cold cache (first product view of the session, before the
// catalog page has ever been visited) still pays that sweep's cost once;
// every subsequent product page reads the warm cache for free.
//
// MATCH ORDER:
//   1. Same sub_type_id (e.g. every other Solitaire Ring) — the tightest match.
//   2. Same type_id but a different sub_type_id (e.g. other Rings) — used
//      to fill out the shelf when the exact sub-type alone doesn't reach
//      `limit`.
//   3. Same item_group_id but a different type_id (e.g. other Diamond
//      Jewellery) — broadest fallback, only reached once tiers 1-2 still
//      haven't filled the shelf.
//
// WITHIN each tier, candidates are ranked by a composite closeness score
// (same metal_id, same karat_id, in-stock-at-this-store) rather than
// sorted on has_stock alone.
//
// FIXED 2026-09-16 (reported: "every card's View Similar shows the exact
// same set, it doesn't update"): the old code sorted each tier by has_stock
// alone, via `Array.prototype.sort` — which is a STABLE sort, so every
// candidate that tied on has_stock (the overwhelming majority within a
// tier) kept the shared catalog's own fixed fetch order. That order never
// depends on which product you clicked "View Similar" on, so two different
// products of the same type/group produced the identical top-N slice, give
// or take whichever one got excluded as "self" — reading as "stuck showing
// the same set" exactly as reported. Scoring against the CLICKED product's
// own metal/karat (and only using stock as one input among several, not
// the sole sort key) makes the ranking — and therefore the resulting
// slice — genuinely depend on the product you started from.

import { useMemo } from 'react';
import { useAllCatalog } from '@/hooks/catalog/useAllCatalog';

/**
 * @param {{
 *   item_id: number, type_id?: number, sub_type_id?: number,
 *   item_group_id?: number, metal_id?: number, karat_id?: number,
 * }|null} product
 *   The product currently on screen — its own sub_type_id/type_id/
 *   item_group_id decide which tier a candidate falls into, and its
 *   metal_id/karat_id/stock rank candidates within a tier (see composite
 *   score below). Pass null while the detail page is still loading; this
 *   hook simply returns an empty list until it resolves.
 * @param {number|null} storeId — the active store (same as useAllCatalog).
 * @param {{ limit?: number, enabled?: boolean }} [options]
 *   enabled (default true) — forwarded to useAllCatalog. Pass `false` to
 *   read whatever's already in the shared tenant-wide sweep's cache
 *   WITHOUT triggering it — used by ProductCard's own "View Similar" icon
 *   (rendered per card, on every grid), so simply deciding whether to show
 *   the icon never forces the ~2,699-item/~15-round sweep that the catalog
 *   page itself deliberately defers until the user searches (see catalog/
 *   page.jsx's `hasSearched` gate). Every mounted observer still gets the
 *   real answer the moment something else (a search, a PDP visit) warms
 *   the shared cache — react-query notifies every observer of that query
 *   key, not just the one that triggered the fetch.
 * @returns {{ items: object[], isLoading: boolean }} items are raw
 *   ProductCatalogRow objects — already the exact shape ProductCard expects
 *   (confirmed live: karat_code/metal_color_code/has_stock/image are all
 *   present directly on this row, no mapping needed).
 */
export function useSimilarProducts(product, storeId, { limit = 12, enabled = true } = {}) {
  const { data: catalog = [], isLoading } = useAllCatalog(storeId, { enabled });

  const items = useMemo(() => {
    const currentId = product?.item_id;
    if (!currentId || catalog.length === 0) return [];

    const subTypeId = product.sub_type_id ?? null;
    const typeId    = product.type_id ?? null;
    const groupId   = product.item_group_id ?? null;
    const metalId   = product.metal_id ?? null;
    const karatId   = product.karat_id ?? null;

    // Ranks candidates WITHIN a tier by closeness to the specific clicked
    // product, not just stock status — this is what makes the result
    // actually depend on which product you started from (see this file's
    // own header for the "same set every time" bug this replaced).
    const closenessScore = (p) => {
      let score = 0;
      if (metalId != null && p.metal_id === metalId) score += 2;
      if (karatId != null && p.karat_id === karatId) score += 1;
      if (p.has_stock === true) score += 1;
      return score;
    };
    const byCloseness = (a, b) => closenessScore(b) - closenessScore(a);

    const pool = catalog.filter((p) => p.item_id !== currentId);

    const sameSubType = subTypeId != null
      ? pool.filter((p) => p.sub_type_id === subTypeId).sort(byCloseness)
      : [];

    const sameTypeOnly = typeId != null
      ? pool
          .filter((p) => p.type_id === typeId && p.sub_type_id !== subTypeId)
          .sort(byCloseness)
      : [];

    const sameGroupOnly = groupId != null
      ? pool
          .filter((p) => p.item_group_id === groupId && p.type_id !== typeId)
          .sort(byCloseness)
      : [];

    return [...sameSubType, ...sameTypeOnly, ...sameGroupOnly].slice(0, limit);
  }, [
    catalog,
    product?.item_id,
    product?.sub_type_id,
    product?.type_id,
    product?.item_group_id,
    product?.metal_id,
    product?.karat_id,
    limit,
  ]);

  return { items, isLoading };
}
