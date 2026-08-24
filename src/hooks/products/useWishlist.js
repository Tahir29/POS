// Two hooks:
//
//   useIsWishlisted(itemId) — O(1) read for a single ProductCard, backed by
//   wishlistSlice's memoized Set selector (see that slice's own comment on
//   why it has to be memoized).
//
//   useToggleWishlist() — returns a function ProductCard's heart button
//   calls on tap. Requires a customer to be attached, same rule
//   useRecentlyViewed.js's recording follows: there's no party_id to key a
//   wishlist entry to otherwise, and "wishlisted by nobody" isn't the
//   feature that was asked for. Dispatches the LOCAL add/remove
//   immediately (so the heart fills/empties with zero perceived latency)
//   — the actual Mongo write happens in store/wishlistMiddleware.js.
//
//   It ALSO patches the customer profile page's react-query cache
//   (useCustomerWishlist's QUERY_KEYS.CUSTOMERS.WISHLIST(customerId) entry)
//   for the same customer, in the same tick. Without this, toggling a heart
//   updates wishlistSlice (instant) but leaves that other, independent
//   query cache untouched — the card only disappeared from the profile's
//   Wishlist tab once react-query's own 60s staleTime happened to elapse
//   and something (refocus, remount) triggered a refetch, so a removed
//   item visibly lingered for a while after its heart had already emptied.
//   Fixed 2026-08-23.

import { useDispatch, useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  addWishlistItemLocal,
  removeWishlistItemLocal,
  selectWishlistedItemIds,
} from '@/store/slices/wishlistSlice';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';
import { QUERY_KEYS } from '@/constants/queryKeys';

export function useIsWishlisted(itemId) {
  const wishlistedIds = useSelector(selectWishlistedItemIds);
  return itemId != null && wishlistedIds.has(itemId);
}

export function useToggleWishlist() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const wishlistedIds = useSelector(selectWishlistedItemIds);
  const { isAttached, customerId } = useCustomerSession();

  /**
   * @param {object} product - whatever ProductCard already has in hand
   *   (item_id, item_code, item_name, image/image_url/image_1, metal_id,
   *   karat_code, has_stock, net_weight, weight, style_id)
   */
  return function toggleWishlist(product) {
    if (!product?.item_id) return;

    if (!isAttached) {
      toast.info('Attach a customer to save items to their wishlist');
      return;
    }

    // useCustomerWishlist keys its query off Number(partyId) — match that
    // exactly here, or a string/number mismatch means this patches a
    // different cache entry than the one the profile page actually reads.
    const wishlistQueryKey = QUERY_KEYS.CUSTOMERS.WISHLIST(Number(customerId));

    if (wishlistedIds.has(product.item_id)) {
      dispatch(removeWishlistItemLocal(product.item_id));
      queryClient.setQueryData(wishlistQueryKey, (old) => (
        Array.isArray(old) ? old.filter((i) => i.item_id !== product.item_id) : old
      ));
    } else {
      const item = {
        item_id:    product.item_id,
        item_code:  product.item_code  ?? null,
        item_name:  product.item_name  ?? null,
        image:      product.image      ?? null,
        image_url:  product.image_url  ?? null,
        image_1:    product.image_1    ?? null,
        metal_id:   product.metal_id   ?? null,
        karat_code: product.karat_code ?? null,
        // One or the other, never both, depending on which surface the
        // heart was tapped from (catalog card → code, PDP → name) — see
        // lib/metalColor.js.
        metal_color_code: product.metal_color_code ?? null,
        metal_color_name: product.metal_color_name ?? null,
        has_stock:  product.has_stock  ?? null,
        net_weight: product.net_weight ?? null,
        weight:     product.weight     ?? null,
        style_id:   product.style_id   ?? null,
        // A CONFIRMED customization (Customize → pick a size → heart), not
        // just the bare design — see the product detail page's
        // wishlistProduct comment. Catalog cards never have a size to
        // confirm, so this is null there, same as always.
        item_size_id:   product.item_size_id   ?? null,
        item_size_name: product.item_size_name ?? null,
      };
      dispatch(addWishlistItemLocal(item));
      queryClient.setQueryData(wishlistQueryKey, (old) => (
        Array.isArray(old) ? [item, ...old.filter((i) => i.item_id !== item.item_id)] : old
      ));
    }
  };
}
