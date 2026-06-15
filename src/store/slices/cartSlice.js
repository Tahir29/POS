// src/store/slices/cartSlice.js
// Manages the shopping cart — items, customer, promos, totals.
// Persisted via Redux Persist (survives page refresh — offline resilience).
// All pricing comes from OrnaVerse API — no independent price computation.

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  items:               [],    // CartItem[]
  customerId:          null,
  customerName:        null,
  customerMobile:      null,
  customerAddress:     null,  // { address, address1, city, state, country, zip } — used as
                               // shipping_address/billing_address at order creation
  appliedPromoCode:    null,
  appliedPromoDetails: null,  // full promo object from OrnaVerse
  appliedGiftCard:     null,
  appliedGiftVoucher:  null,
  discountAmount:      0,
  subtotal:            0,
  total:               0,
};

// ── HELPERS ──────────────────────────────────────────────────
// Recalculates subtotal and total after any cart mutation.
// Called at the end of every reducer that modifies items or discount.
const recalculateTotals = (state) => {
  state.subtotal = state.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );
  state.total = Math.max(0, state.subtotal - state.discountAmount);
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {

    // Add a new item or increment quantity if item already exists
    addItem: (state, action) => {
      const incoming = action.payload;
      const existing = state.items.find(
        (item) =>
          item.itemId  === incoming.itemId &&
          item.sizeId  === incoming.sizeId &&
          item.styleId === incoming.styleId
      );
      if (existing) {
        existing.quantity += incoming.quantity ?? 1;
      } else {
        state.items.push({
          itemId:     incoming.itemId,
          itemCode:   incoming.itemCode,
          itemName:   incoming.itemName,
          sku:        incoming.sku,
          quantity:   incoming.quantity ?? 1,
          unitPrice:  incoming.unitPrice,
          styleId:    incoming.styleId  ?? null,
          sizeId:     incoming.sizeId   ?? null,
          sizeName:   incoming.sizeName ?? null,
          attributes: incoming.attributes ?? {},
          image:      incoming.image    ?? incoming.imageUrl ?? null,
        });
      }
      recalculateTotals(state);
    },

    // Remove an item from the cart entirely
    removeItem: (state, action) => {
      const { itemId, sizeId, styleId } = action.payload;
      state.items = state.items.filter(
        (item) =>
          !(item.itemId  === itemId &&
            item.sizeId  === sizeId &&
            item.styleId === styleId)
      );
      recalculateTotals(state);
    },

    // Update quantity for a specific cart item
    updateQuantity: (state, action) => {
      const { itemId, sizeId, styleId, quantity } = action.payload;
      const item = state.items.find(
        (i) =>
          i.itemId  === itemId &&
          i.sizeId  === sizeId &&
          i.styleId === styleId
      );
      if (item) {
        item.quantity = quantity;
      }
      recalculateTotals(state);
    },

    // Attach a found/created customer to the cart
    attachCustomer: (state, action) => {
      const { customerId, customerName, customerMobile, customerAddress } = action.payload;
      state.customerId      = customerId;
      state.customerName    = customerName;
      state.customerMobile  = customerMobile;
      state.customerAddress = customerAddress ?? null;
    },

    // Remove the attached customer from the cart
    detachCustomer: (state) => {
      state.customerId      = null;
      state.customerName    = null;
      state.customerMobile  = null;
      state.customerAddress = null;
    },

    // Apply a validated promo code and its discount
    applyPromo: (state, action) => {
      const { promoCode, promoDetails, discountAmount } = action.payload;
      state.appliedPromoCode    = promoCode;
      state.appliedPromoDetails = promoDetails;
      state.discountAmount      = discountAmount;
      recalculateTotals(state);
    },

    // Remove the applied promo code
    removePromo: (state) => {
      state.appliedPromoCode    = null;
      state.appliedPromoDetails = null;
      state.discountAmount      = 0;
      recalculateTotals(state);
    },

    // Apply a validated gift card
    applyGiftCard: (state, action) => {
      state.appliedGiftCard = action.payload;
    },

    // Apply a validated gift voucher
    applyGiftVoucher: (state, action) => {
      state.appliedGiftVoucher = action.payload;
    },

    // Clear the entire cart — called after successful order creation
    clearCart: (state) => {
      return initialState;
    },

  },
});

// ── ACTIONS ──────────────────────────────────────────────────
export const {
  addItem,
  removeItem,
  updateQuantity,
  attachCustomer,
  detachCustomer,
  applyPromo,
  removePromo,
  applyGiftCard,
  applyGiftVoucher,
  clearCart,
} = cartSlice.actions;

// ── SELECTORS ────────────────────────────────────────────────
export const selectCartItems          = (state) => state.cart.items;
export const selectCartItemCount      = (state) => state.cart.items.reduce((sum, i) => sum + i.quantity, 0);
export const selectCartSubtotal       = (state) => state.cart.subtotal;
export const selectCartTotal          = (state) => state.cart.total;
export const selectCartDiscount       = (state) => state.cart.discountAmount;
export const selectCartCustomerId     = (state) => state.cart.customerId;
export const selectCartCustomerName   = (state) => state.cart.customerName;
export const selectCartCustomerMobile = (state) => state.cart.customerMobile;
export const selectCartCustomerAddress = (state) => state.cart.customerAddress;
export const selectAppliedPromoCode   = (state) => state.cart.appliedPromoCode;
export const selectAppliedPromoDetails= (state) => state.cart.appliedPromoDetails;
export const selectIsCartEmpty        = (state) => state.cart.items.length === 0;

export default cartSlice.reducer;