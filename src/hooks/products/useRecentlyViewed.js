// Two hooks, two responsibilities:
//
//   useRecordProductView(product, hasStock) — called from the product
//   detail page. Records a view ONLY when a customer is attached (a
//   walk-in with no customer attached is never tracked — there's no
//   party_id to key it to, and recording "someone viewed this" with no
//   identity behind it isn't the feature that was asked for). Dispatches
//   locally to Redux; the actual Mongo write happens in
//   store/recentlyViewedMiddleware.js, not here — this hook only decides
//   WHEN to record, never HOW it's stored. Guards against re-firing on
//   every re-render of the same product via a ref, not a dependency array —
//   the effect's own deps already limit it to once per (isAttached, product
//   identity) change, but a ref makes the "already recorded this exact item
//   this mount" intent explicit rather than relying on effect timing.
//
//   useRecentlyViewedItems(excludeItemId) — read-only selector for
//   RecentlyViewedCarousel, pre-excluding whichever product is currently on
//   screen (no point telling someone they "recently viewed" the page
//   they're already on).

import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addRecentlyViewedItem, selectRecentlyViewedItems } from '@/store/slices/recentlyViewedSlice';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';
import { deriveKaratCode } from '@/lib/karat';

/**
 * @param {object|null} product - the Items/Retrieve entity from useProductDetail
 * @param {'in_stock'|'out_stock'|'error'|null} stockStatus - the product
 *   page's own per-active-store stock verdict (see its `stockStatus`), in
 *   its RAW three-state form — not pre-collapsed to a boolean. Deliberately
 *   not product.pieces: that field is the master record's pieces count, not
 *   scoped to any store, and this codebase has already been burned once by
 *   trusting an unscoped `pieces` field for a stock decision (see
 *   useDesignVariants.js's header comment on the same mistake with
 *   style_variants[].pieces).
 *
 *   FIXED 2026-08-22 — a real, live-confirmed bug: this used to take a
 *   plain boolean (`stockStatus === 'in_stock'`), computed at the CALL
 *   SITE. That collapses "loading" (stockStatus is null while
 *   useStockByStores' request is in flight), "error", AND genuine
 *   "out_stock" into the exact same `false`. Items/Retrieve (product)
 *   reliably resolves before the separate GetStockByStores call
 *   (stockStatus) does, so the effect below fired on that FIRST render —
 *   while stock was still loading — locked in has_stock:false via the ref
 *   guard, and never got a chance to correct it once the real stock status
 *   arrived a moment later. Every recorded view showed "Made to Order" in
 *   the carousel regardless of real stock. Fixed by waiting for a genuine
 *   verdict ('in_stock' or 'out_stock') before recording at all — 'error'
 *   and the loading null both just defer, they never get treated as a
 *   confirmed zero.
 */
export function useRecordProductView(product, stockStatus) {
  const dispatch = useDispatch();
  const { isAttached } = useCustomerSession();
  const recordedItemIdRef = useRef(null);

  useEffect(() => {
    if (!isAttached || !product?.item_id) return;
    if (recordedItemIdRef.current === product.item_id) return;
    if (stockStatus !== 'in_stock' && stockStatus !== 'out_stock') return; // still loading, or errored — wait for a real verdict
    recordedItemIdRef.current = product.item_id;

    dispatch(addRecentlyViewedItem({
      item_id:    product.item_id,
      item_code:  product.item_code ?? null,
      item_name:  product.item_name ?? null,
      image:      product.image     ?? null,
      image_url:  product.image_url ?? null,
      image_1:    product.image_1   ?? null,
      metal_id:   product.metal_id  ?? null,
      karat_code: deriveKaratCode(product.karat_name),
      // Items/Retrieve (this hook's source) only ever has the full name,
      // not the catalog list's short code — see lib/metalColor.js.
      metal_color_code: product.metal_color_code ?? null,
      metal_color_name: product.metal_color_name ?? null,
      has_stock:  stockStatus === 'in_stock',
      net_weight: product.net_weight ?? null,
      weight:     product.weight     ?? null,
      style_id:   product.style_id   ?? null,
    }));
  }, [isAttached, product, stockStatus, dispatch]);
}

export function useRecentlyViewedItems(excludeItemId = null) {
  const items = useSelector(selectRecentlyViewedItems);
  return excludeItemId != null
    ? items.filter((i) => i.item_id !== excludeItemId)
    : items;
}
