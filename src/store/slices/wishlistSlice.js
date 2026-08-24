// src/store/slices/wishlistSlice.js
//
// Current customer's wishlist — in-memory only, deliberately NOT in
// persistConfig's whitelist. Same reasoning as recentlyViewedSlice: this
// only ever describes the CURRENTLY ATTACHED customer, and
// wishlistMiddleware re-hydrates it from Mongo on every attach (and on
// REHYDRATE, if a customer was already attached before a refresh) — so
// nothing is lost by not persisting the list itself, and a stale list
// never survives past whoever's actually attached.
//
// No async logic here, no network calls — see store/wishlistMiddleware.js
// for the Mongo fetch/add/remove side of this feature.

import { createSlice, createSelector } from '@reduxjs/toolkit';

const initialState = {
  items: [], // most-recently-added first
};

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    // Optimistic local add — dispatched the moment the heart is tapped, so
    // it fills instantly rather than waiting on the network round trip.
    // The middleware persists this to Mongo separately.
    addWishlistItemLocal(state, action) {
      const item = action.payload;
      if (!item?.item_id) return;
      if (state.items.some((i) => i.item_id === item.item_id)) return; // already there
      state.items = [item, ...state.items];
    },

    removeWishlistItemLocal(state, action) {
      const itemId = action.payload;
      state.items = state.items.filter((i) => i.item_id !== itemId);
    },

    // Replaces the whole list — used right after fetching a customer's
    // wishlist from Mongo (on attach, or on app load if already attached).
    hydrateWishlist(state, action) {
      state.items = Array.isArray(action.payload) ? action.payload : [];
    },

    // Fired on cart/detachCustomer (see wishlistMiddleware) so the NEXT
    // customer attached at this terminal never sees a previous customer's
    // wishlist, even for a moment.
    clearWishlist(state) {
      state.items = [];
    },
  },
});

export const {
  addWishlistItemLocal,
  removeWishlistItemLocal,
  hydrateWishlist,
  clearWishlist,
} = wishlistSlice.actions;

export const selectWishlistItems = (state) => state.wishlist.items;

// O(1) "is this item wishlisted" lookups from every ProductCard, rather
// than each card doing its own items.some(...) scan — matters once a
// catalog grid has dozens of cards mounted at once, each asking this on
// every wishlist change. createSelector (not a plain function) matters
// here too: without memoizing, this would build a brand-new Set on every
// single store update, and useSelector's reference-equality check would
// then see a "changed" value on every render regardless of whether the
// wishlist actually did — re-rendering every mounted card on every
// unrelated state change.
export const selectWishlistedItemIds = createSelector(
  [selectWishlistItems],
  (items) => new Set(items.map((i) => i.item_id)),
);

export default wishlistSlice.reducer;
