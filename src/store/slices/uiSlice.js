// src/store/slices/uiSlice.js
// Manages UI-only state — sidebar, modals, global loading.
// NOT persisted — resets to default on every app load.

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  sidebarOpen:   false,
  activeModal:   null,   // string identifier of the open modal, or null
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

    openModal:  (state, action) => { state.activeModal = action.payload; },
    closeModal: (state)         => { state.activeModal = null; },

    openCart:  (state) => { state.cartOpen = true;  },
    closeCart: (state) => { state.cartOpen = false; },
    toggleCart:(state) => { state.cartOpen = !state.cartOpen; },

    setGlobalLoading: (state, action) => { state.globalLoading = action.payload; },

  },
});

// ── ACTIONS ──────────────────────────────────────────────────
export const {
  openSidebar,
  closeSidebar,
  toggleSidebar,
  openModal,
  closeModal,
  openCart,
  closeCart,
  toggleCart,
  setGlobalLoading,
} = uiSlice.actions;

// ── SELECTORS ────────────────────────────────────────────────
export const selectSidebarOpen   = (state) => state.ui.sidebarOpen;
export const selectActiveModal   = (state) => state.ui.activeModal;
export const selectGlobalLoading = (state) => state.ui.globalLoading;
export const selectCartOpen      = (state) => state.ui.cartOpen;

export default uiSlice.reducer;