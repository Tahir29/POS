// src/store/wishlistMiddleware.js
//
// All the async side-effects for the wishlist feature live here, not in
// components or the slice — same split as recentlyViewedMiddleware.js /
// abandonedCartMiddleware.js and for the same reason: attach/detach fire
// from more than one call site, so catching them at the action level
// guarantees this runs exactly once regardless of which component
// triggered it.
//
// THREE responsibilities:
//   1. cart/attachCustomer (and REHYDRATE, if a customer was already
//      attached before a refresh) — fetch this customer's wishlist from
//      Mongo, hydrate the slice with it so every ProductCard's heart icon
//      renders correctly filled/outline right away.
//   2. cart/detachCustomer — clear the slice. A wishlist is exactly the
//      kind of thing that must never leak from one customer to the next at
//      a shared terminal.
//   3. wishlist/addWishlistItemLocal / wishlist/removeWishlistItemLocal —
//      persist that one change to Mongo (fire-and-forget, same pattern as
//      the other two features — never blocks the UI, never surfaces a
//      network error to the operator; the heart already updated
//      optimistically before this even runs).

import { REHYDRATE } from 'redux-persist';
import { hydrateWishlist, clearWishlist } from './slices/wishlistSlice';

// FIXED 2026-09-09 — customerMobile threaded through fetch/remove (add's
// POST body already carried it). Same root cause and same fix as
// abandonedCartMiddleware.js's own comment: party_id is assigned per
// OrnaVerse TENANT, so it isn't stable across a UAT/LIVE switch; mobile is.
function buildQuery(partyId, customerMobile) {
  const params = new URLSearchParams();
  if (partyId != null) params.set('party_id', String(partyId));
  if (customerMobile) params.set('customer_mobile', customerMobile);
  return params;
}

// Same-origin calls throughout this file — the operator's session cookie
// rides along automatically; the route itself rejects if no one's signed in.
async function fetchWishlist(partyId, customerMobile) {
  try {
    const res = await fetch(`/api/customers/wishlist?${buildQuery(partyId, customerMobile)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.items) ? data.items : [];
  } catch (err) {
    console.warn('[wishlistMiddleware] fetch failed', err);
    return [];
  }
}

function addToWishlist(partyId, customerName, customerMobile, item) {
  fetch('/api/customers/wishlist', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ party_id: partyId, customerName, customerMobile, item }),
  }).catch((err) => console.warn('[wishlistMiddleware] add failed', err));
}

// itemSizeId (2026-08-24) — must reach Mongo too, or the DELETE would match
// by item_id alone there and remove every size variant of this item_id
// instead of just the one that was actually un-hearted. See
// lib/mongo/wishlist.js's removeWishlistItem.
function removeFromWishlist(partyId, customerMobile, itemId, itemSizeId) {
  const params = buildQuery(partyId, customerMobile);
  params.set('item_id', String(itemId));
  if (itemSizeId != null) params.set('item_size_id', itemSizeId);
  fetch(`/api/customers/wishlist?${params.toString()}`, {
    method:  'DELETE',
  }).catch((err) => console.warn('[wishlistMiddleware] remove failed', err));
}

export const wishlistMiddleware = (store) => (next) => (action) => {
  const result = next(action);

  switch (action.type) {
    case REHYDRATE: {
      const persistedCart = action.payload?.cart;
      const persistedAuth = action.payload?.auth;
      const customerId = persistedCart?.customerId;
      const customerMobile = persistedCart?.customerMobile;
      const isAuthenticated = persistedAuth?.isAuthenticated;
      if (!customerId || !isAuthenticated) break;

      fetchWishlist(customerId, customerMobile).then((items) => {
        store.dispatch(hydrateWishlist(items));
      });
      break;
    }

    case 'cart/attachCustomer': {
      const { customerId, customerMobile } = action.payload;
      const isAuthenticated = store.getState().auth?.isAuthenticated;
      if (!customerId || !isAuthenticated) break;

      fetchWishlist(customerId, customerMobile).then((items) => {
        store.dispatch(hydrateWishlist(items));
      });
      break;
    }

    case 'cart/detachCustomer': {
      store.dispatch(clearWishlist());
      break;
    }

    case 'wishlist/addWishlistItemLocal': {
      const state = store.getState();
      const { customerId, customerName, customerMobile } = state.cart;
      const isAuthenticated = state.auth?.isAuthenticated;
      if (!customerId || !isAuthenticated) break; // shouldn't happen — useToggleWishlist already checks isAttached

      addToWishlist(customerId, customerName, customerMobile, action.payload);
      break;
    }

    case 'wishlist/removeWishlistItemLocal': {
      const state = store.getState();
      const { customerId, customerMobile } = state.cart;
      const isAuthenticated = state.auth?.isAuthenticated;
      if (!customerId || !isAuthenticated) break;

      const { item_id, item_size_id } = action.payload;
      removeFromWishlist(customerId, customerMobile, item_id, item_size_id);
      break;
    }

    default:
      break;
  }

  return result;
};
