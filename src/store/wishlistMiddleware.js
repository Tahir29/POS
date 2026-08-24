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

async function fetchWishlist(partyId, token) {
  try {
    const res = await fetch(`/api/customers/wishlist?party_id=${partyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.items) ? data.items : [];
  } catch (err) {
    console.warn('[wishlistMiddleware] fetch failed', err);
    return [];
  }
}

function addToWishlist(partyId, customerName, customerMobile, item, token) {
  fetch('/api/customers/wishlist', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ party_id: partyId, customerName, customerMobile, item }),
  }).catch((err) => console.warn('[wishlistMiddleware] add failed', err));
}

function removeFromWishlist(partyId, itemId, token) {
  fetch(`/api/customers/wishlist?party_id=${partyId}&item_id=${itemId}`, {
    method:  'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).catch((err) => console.warn('[wishlistMiddleware] remove failed', err));
}

export const wishlistMiddleware = (store) => (next) => (action) => {
  const result = next(action);

  switch (action.type) {
    case REHYDRATE: {
      const persistedCart = action.payload?.cart;
      const persistedAuth = action.payload?.auth;
      const customerId = persistedCart?.customerId;
      const token       = persistedAuth?.accessToken;
      if (!customerId || !token) break;

      fetchWishlist(customerId, token).then((items) => {
        store.dispatch(hydrateWishlist(items));
      });
      break;
    }

    case 'cart/attachCustomer': {
      const { customerId } = action.payload;
      const token = store.getState().auth?.accessToken;
      if (!customerId || !token) break;

      fetchWishlist(customerId, token).then((items) => {
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
      const token = state.auth?.accessToken;
      if (!customerId || !token) break; // shouldn't happen — useToggleWishlist already checks isAttached

      addToWishlist(customerId, customerName, customerMobile, action.payload, token);
      break;
    }

    case 'wishlist/removeWishlistItemLocal': {
      const state = store.getState();
      const { customerId } = state.cart;
      const token = state.auth?.accessToken;
      if (!customerId || !token) break;

      removeFromWishlist(customerId, action.payload, token);
      break;
    }

    default:
      break;
  }

  return result;
};
