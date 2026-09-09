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
  // ADDED 2026-09-09 — see checkout/page.jsx's handlePaymentConfirmed and
  // HeaderCustomerControl. Deliberately NOT in cartSlice (persisted) even
  // though it's conceptually cart/checkout state: a crash/reload mid-sale
  // would freeze a persisted `true` forever (nothing left running to ever
  // flip it back), permanently blocking customer switching on next load.
  // This slice's own "NOT persisted" guarantee (see header) makes it the
  // safe home — always starts false on a fresh app load.
  checkoutInProgress: false,
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

    // FIXED 2026-09-09 — a customer switch/detach mid-payment-confirmation
    // (the header's detach control has no guard of its own and is reachable
    // from every screen, checkout included) could redirect the checkout
    // page away before its own useEffect(isConfirmed) ever ran — the sale
    // still completed server-side (the mutation isn't tied to this
    // component's lifetime), but the cart was never cleared and the
    // operator never saw the confirmation screen, risking a duplicate
    // charge on retry. checkout/page.jsx sets this true for the duration of
    // placeOrder/placeInvoice; HeaderCustomerControl disables switching
    // while it's true.
    setCheckoutInProgress: (state, action) => { state.checkoutInProgress = action.payload; },

  },
});

export const {
  openSidebar,
  closeSidebar,
  toggleSidebar,
  openCart,
  closeCart,
  setGlobalLoading,
  setCheckoutInProgress,
} = uiSlice.actions;

export const selectSidebarOpen   = (state) => state.ui.sidebarOpen;
export const selectGlobalLoading = (state) => state.ui.globalLoading;
export const selectCartOpen      = (state) => state.ui.cartOpen;
export const selectCheckoutInProgress = (state) => state.ui.checkoutInProgress;

export default uiSlice.reducer;