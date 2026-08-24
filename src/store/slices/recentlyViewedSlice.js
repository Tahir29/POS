// src/store/slices/recentlyViewedSlice.js
//
// Current customer's recently-viewed product list — in-memory only,
// deliberately NOT in persistConfig's whitelist. Two reasons:
//   1. It's customer-specific, and the attached customer itself isn't
//      guaranteed to still be attached after a hard refresh in the same
//      way — recentlyViewedMiddleware re-hydrates this from Mongo on
//      REHYDRATE (if a customer was already attached) and on every fresh
//      `cart/attachCustomer`, so nothing is lost by not persisting the
//      list itself.
//   2. Never duplicates customerId/customerName/customerMobile — cartSlice
//      already owns that (see useCustomerSession.js). This slice only ever
//      answers "what has the currently-attached customer viewed", and asks
//      cartSlice who that is whenever it needs to know (see
//      recentlyViewedMiddleware.js), rather than keeping its own copy that
//      could drift out of sync with the real attach/detach state.
//
// This slice holds NO async logic and makes NO network calls itself — see
// store/recentlyViewedMiddleware.js for the Mongo fetch/persist side of
// this feature. Kept that way on purpose, matching cartSlice/analyticsMiddleware's
// existing split between "what changed" (slice) and "what that change causes
// to happen elsewhere" (middleware).

import { createSlice } from '@reduxjs/toolkit';

// Local cap mirrors the server-side $slice cap in lib/mongo/recentlyViewed.js
// (kept in sync manually — see that file's own comment). Bounds memory and
// keeps the carousel from ever needing to scroll through more than a
// sensible handful of products.
const MAX_ITEMS = 20;

const initialState = {
  items: [], // most-recently-viewed first
};

const recentlyViewedSlice = createSlice({
  name: 'recentlyViewed',
  initialState,
  reducers: {
    // Called by hooks/products/useRecentlyViewed.js whenever an attached
    // customer opens a product detail page. De-dupes by item_id — viewing
    // the same product again moves it back to the front rather than
    // appearing twice — and caps the list so it can't grow unbounded across
    // a long shift.
    addRecentlyViewedItem(state, action) {
      const item = action.payload;
      if (!item?.item_id) return;
      state.items = [
        item,
        ...state.items.filter((i) => i.item_id !== item.item_id),
      ].slice(0, MAX_ITEMS);
    },

    // Replaces the whole list — used by recentlyViewedMiddleware right
    // after it fetches a customer's history from Mongo (on attach, or on
    // app load if a customer was already attached before the refresh).
    hydrateRecentlyViewed(state, action) {
      state.items = Array.isArray(action.payload) ? action.payload.slice(0, MAX_ITEMS) : [];
    },

    // Fired on cart/detachCustomer (see recentlyViewedMiddleware) so the
    // NEXT customer attached at this terminal never sees a previous
    // customer's recently-viewed list, even for a moment.
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
