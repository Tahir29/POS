// src/store/slices/storeSlice.js
// Manages active store context — which store the POS is operating in.
// Persisted via Redux Persist (survives page refresh).
// All store-scoped API calls read activeStoreId from here.

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  activeStoreId:   null,
  activeStoreName: null,
  activeStoreCode: null,
  availableStores: [],
};

const storeSlice = createSlice({
  name: 'store',
  initialState,
  reducers: {

    // Called after GetUserStores returns — populates available list
    setAvailableStores: (state, action) => {
      state.availableStores = action.payload;
    },

    // Called when user selects a store (single or multiple store flow)
    setActiveStore: (state, action) => {
      const { storeId, storeName, storeCode } = action.payload;
      state.activeStoreId   = storeId;
      state.activeStoreName = storeName;
      state.activeStoreCode = storeCode;
    },

    // Called on logout — clears store context
    clearStore: (state) => {
      state.activeStoreId   = null;
      state.activeStoreName = null;
      state.activeStoreCode = null;
      state.availableStores = [];
    },

  },
});

// ── ACTIONS ──────────────────────────────────────────────────
export const { setAvailableStores, setActiveStore, clearStore } = storeSlice.actions;

// ── SELECTORS ────────────────────────────────────────────────
export const selectActiveStoreId   = (state) => state.store.activeStoreId;
export const selectActiveStoreName = (state) => state.store.activeStoreName;
export const selectActiveStoreCode = (state) => state.store.activeStoreCode;
export const selectAvailableStores = (state) => state.store.availableStores;

export default storeSlice.reducer;