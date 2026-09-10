// src/store/slices/wishlistSlice.js
// Current customer's wishlist. In-memory only (not persisted) —
// wishlistMiddleware.js re-hydrates it from Mongo on attach/REHYDRATE and
// owns all async/network logic for this feature.

import { createSlice, createSelector } from '@reduxjs/toolkit';

const initialState = {
  items: [], // most-recently-added first
};

// A wishlist entry's real identity is (item_id, item_size_id), not item_id alone —
// a base design and a specific confirmed size are separate wishlistable entries.
// null/undefined normalize to the same key so an unsized catalog card matches itself.
export function wishlistKey(itemId, itemSizeId) {
  return `${itemId}:${itemSizeId ?? ''}`;
}

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    // Optimistic local add — fills instantly on tap; middleware persists to Mongo separately.
    addWishlistItemLocal(state, action) {
      const item = action.payload;
      if (!item?.item_id) return;
      // Matches by the full (item_id, item_size_id) identity — see wishlistKey above.
      const already = state.items.some((i) =>
        i.item_id === item.item_id && (i.item_size_id ?? null) === (item.item_size_id ?? null)
      );
      if (already) return;
      state.items = [item, ...state.items];
    },

    // payload: { item_id, item_size_id } — removes only that one variant.
    removeWishlistItemLocal(state, action) {
      const { item_id, item_size_id } = action.payload;
      state.items = state.items.filter((i) =>
        !(i.item_id === item_id && (i.item_size_id ?? null) === (item_size_id ?? null))
      );
    },

    hydrateWishlist(state, action) {
      state.items = Array.isArray(action.payload) ? action.payload : [];
    },

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

// O(1) lookup for every ProductCard's heart state. Memoized via createSelector —
// a plain function would build a new Set on every store update and force a
// reference-equality re-render on every card for any unrelated state change.
export const selectWishlistedItemIds = createSelector(
  [selectWishlistItems],
  (items) => new Set(items.map((i) => wishlistKey(i.item_id, i.item_size_id))),
);

export default wishlistSlice.reducer;
