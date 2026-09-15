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
//   1. Same type_id (e.g. every other Bracelet) — the closest match.
//   2. Same item_group_id but a different type_id (e.g. other Diamond
//      Jewellery) — broader fallback, only used to fill out the shelf when
//      same-type alone doesn't reach `limit`.
// Within each tier, in-stock-at-this-store items sort first — a shelf of
// products the customer can actually walk out with today, ahead of ones
// that would need to be Made to Order.

import { useMemo } from 'react';
import { useAllCatalog } from '@/hooks/catalog/useAllCatalog';

/**
 * @param {{ item_id: number, type_id?: number, item_group_id?: number }|null} product
 *   The product currently on screen — its own type_id/item_group_id decide
 *   what counts as "similar". Pass null while the detail page is still
 *   loading; this hook simply returns an empty list until it resolves.
 * @param {number|null} storeId — the active store (same as useAllCatalog).
 * @param {{ limit?: number }} [options]
 * @returns {{ items: object[], isLoading: boolean }} items are raw
 *   ProductCatalogRow objects — already the exact shape ProductCard expects
 *   (confirmed live: karat_code/metal_color_code/has_stock/image are all
 *   present directly on this row, no mapping needed).
 */
export function useSimilarProducts(product, storeId, { limit = 12 } = {}) {
  const { data: catalog = [], isLoading } = useAllCatalog(storeId);

  const items = useMemo(() => {
    const currentId = product?.item_id;
    if (!currentId || catalog.length === 0) return [];

    const typeId  = product.type_id ?? null;
    const groupId = product.item_group_id ?? null;
    const inStockFirst = (a, b) => (b.has_stock === true) - (a.has_stock === true);

    const pool = catalog.filter((p) => p.item_id !== currentId);

    const sameType = typeId != null
      ? pool.filter((p) => p.type_id === typeId).sort(inStockFirst)
      : [];

    const sameGroupOnly = groupId != null
      ? pool
          .filter((p) => p.item_group_id === groupId && p.type_id !== typeId)
          .sort(inStockFirst)
      : [];

    return [...sameType, ...sameGroupOnly].slice(0, limit);
  }, [catalog, product?.item_id, product?.type_id, product?.item_group_id, limit]);

  return { items, isLoading };
}
