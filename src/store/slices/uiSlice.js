// src/store/slices/uiSlice.js
// Manages UI-only state — sidebar, modals, global loading.
// NOT persisted — resets to default on every app load.

import { createSlice } from '@reduxjs/toolkit';

// REMOVED 2026-09-08 — activeModal/openModal/closeModal/selectActiveModal and
// toggleCart had zero callers anywhere (confirmed via a dead-code audit) — no
// component ever dispatched openModal/closeModal or read selectActiveModal,
// and the cart drawer only ever calls openCart/closeCart directly, never
// toggleCart. globalLoading/setGlobalLoading/selectGlobalLoading are NOT
// dead — still wired to PageLoader — so left untouched.

const initialState = {
  sidebarOpen:   false,
  globalLoading: false,
  cartOpen:      false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {

    openSidebar:  (state) => { state.sidebarOpen = true;  },
    closeSidebar: (state) => { state.sidebarOpen = false; },
    toggleSidebar:(state) => { state.sidebarOpen = !state.sidebarOpen; },

    openCart:  (state) => { state.cartOpen = true;  },
    closeCart: (state) => { state.cartOpen = false; },

    setGlobalLoading: (state, action) => { state.globalLoading = action.payload; },

  },
});

export const {
  openSidebar,
  closeSidebar,
  toggleSidebar,
  openCart,
  closeCart,
  setGlobalLoading,
} = uiSlice.actions;

export const selectSidebarOpen   = (state) => state.ui.sidebarOpen;
export const selectGlobalLoading = (state) => state.ui.globalLoading;
export const selectCartOpen      = (state) => state.ui.cartOpen;

export default uiSlice.reducer;