// src/store/slices/recentlyViewedSlice.js
// Current customer's recently-viewed product list. In-memory only (not
// persisted) — recentlyViewedMiddleware.js re-hydrates it from Mongo on
// attach/REHYDRATE, and owns all async/network logic for this feature.

import { createSlice } from '@reduxjs/toolkit';

// Mirrors the server-side $slice cap in lib/mongo/recentlyViewed.js — keep in sync manually.
const MAX_ITEMS = 20;

const initialState = {
  items: [], // most-recently-viewed first
};

const recentlyViewedSlice = createSlice({
  name: 'recentlyViewed',
  initialState,
  reducers: {
    // De-dupes by item_id (re-viewing moves it to front) and caps at MAX_ITEMS.
    addRecentlyViewedItem(state, action) {
      const item = action.payload;
      if (!item?.item_id) return;
      state.items = [
        item,
        ...state.items.filter((i) => i.item_id !== item.item_id),
      ].slice(0, MAX_ITEMS);
    },

    hydrateRecentlyViewed(state, action) {
      state.items = Array.isArray(action.payload) ? action.payload.slice(0, MAX_ITEMS) : [];
    },

    clearRecentlyViewed(state) {
      state.items = [];
    },
  },
});

export const {
  addRecentlyViewedItem,
  hydrateRecentlyViewed,
  clearRecentlyViewed,
} = recentlyViewedSlice.actions;

export const selectRecentlyViewedItems = (state) => state.recentlyViewed.items;

export default recentlyViewedSlice.reducer;
