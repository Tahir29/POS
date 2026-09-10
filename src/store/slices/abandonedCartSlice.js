// src/store/slices/abandonedCartSlice.js
// Holds whatever abandoned-cart snapshot Mongo has for the currently attached
// customer — informational only (the live cart is cartSlice). Populated by
// abandonedCartMiddleware.js, which owns all Mongo fetch/save/delete logic.

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
    // record is the Mongo document, or null/undefined if the customer has none.
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

    clearAbandonedCartState() {
      return { ...initialState };
    },
  },
});

export const { setAbandonedCart, clearAbandonedCartState } = abandonedCartSlice.actions;

export default abandonedCartSlice.reducer;
