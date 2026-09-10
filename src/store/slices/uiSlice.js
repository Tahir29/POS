// src/store/slices/uiSlice.js
// Manages UI-only state — sidebar, modals, global loading.
// NOT persisted — resets to default on every app load.

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  sidebarOpen:   false,
  globalLoading: false,
  cartOpen:      false,
  // Deliberately kept in this NOT-persisted slice rather than cartSlice: a
  // crash/reload mid-sale must not freeze a persisted `true` forever, which
  // would permanently block customer switching. See checkout/page.jsx's
  // handlePaymentConfirmed and HeaderCustomerControl.
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

    // Guards against a customer switch/detach mid-payment-confirmation redirecting
    // away from checkout before it clears the cart (risking a duplicate charge on
    // retry). checkout/page.jsx sets this for the duration of placeOrder/placeInvoice;
    // HeaderCustomerControl disables customer switching while it's true.
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