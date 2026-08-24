// src/store/slices/abandonedCartSlice.js
//
// Holds whatever abandoned-cart snapshot Mongo has for the CURRENTLY
// ATTACHED customer — informational, not the live cart itself (that's
// cartSlice). Populated by store/abandonedCartMiddleware.js right after a
// customer attaches, so it's available for:
//   1. The restore itself — the middleware also dispatches cartSlice's own
//      restoreCart() straight from this data when the live cart is empty.
//   2. Future UI — a customer profile / marketing view showing "this
//      customer has ₹X sitting in an abandoned cart" without a second
//      network round trip, since it's already sitting in Redux by the time
//      any such screen would want it.
//
// Same split as recentlyViewedSlice: no async logic here, no network
// calls — see abandonedCartMiddleware.js for the Mongo fetch/save/delete
// side of this feature.

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  items:          [],
  customerName:   null,
  customerMobile: null,
  subtotal:       null,
  taxAmount:      null,
  total:          null,
  updatedAt:      null,
};

const abandonedCartSlice = createSlice({
  name: 'abandonedCart',
  initialState,
  reducers: {
    // record is the Mongo document (or null/undefined if the customer has
    // none) — see abandonedCartMiddleware's fetch.
    setAbandonedCart(state, action) {
      const record = action.payload;
      if (!record) return { ...initialState };
      return {
        items:          Array.isArray(record.items) ? record.items : [],
        customerName:   record.customerName   ?? null,
        customerMobile: record.customerMobile ?? null,
        subtotal:       record.subtotal  ?? null,
        taxAmount:      record.taxAmount ?? null,
        total:          record.total     ?? null,
        updatedAt:      record.updatedAt ?? null,
      };
    },

    // Fired on detach and on clearCart (see the middleware) — this slice
    // only ever describes the CURRENTLY attached customer's saved cart, so
    // it's meaningless the moment nobody's attached or the cart's resolved.
    clearAbandonedCartState() {
      return { ...initialState };
    },
  },
});

export const { setAbandonedCart, clearAbandonedCartState } = abandonedCartSlice.actions;

export const selectAbandonedCart = (state) => state.abandonedCart;

export default abandonedCartSlice.reducer;
