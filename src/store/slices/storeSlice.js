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

// GetUserStores returns this field as PascalCase `UserId` on UAT — NOT `user_id`
// as v1.json's schema declares (confirmed against a live UAT response 2026-07-13).
// Every other field on the row (company_id, mailing_name, etc.) is snake_case as
// documented; this one field alone is inconsistent. Checking both keys defensively
// in case Live/UAT ever diverge on this.
export const selectCurrentUserId = (state) =>
  state.store.availableStores?.[0]?.UserId ??
  state.store.availableStores?.[0]?.user_id ??
  null;

export default storeSlice.reducer;