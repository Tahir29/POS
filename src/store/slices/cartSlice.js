// src/store/slices/cartSlice.js
// Manages the shopping cart — items, customer, promos, totals.
// Persisted via Redux Persist (survives page refresh — offline resilience).
// All pricing comes from OrnaVerse API — no independent price computation.

import { createSlice } from '@reduxjs/toolkit';
import { REHYDRATE } from 'redux-persist';

const initialState = {
  items:               [],    // CartItem[]
  customerId:          null,
  customerName:        null,
  customerMobile:      null,
  customerAddress:     null,  // { address, address1, city, state, country, zip } — used as
                               // shipping_address/billing_address at order creation
  appliedPromos:       [],    // { promoCode, promoDetails, discountAmount }[] — multiple
                               // promos can stack; "similar" (same discount type) ones are
                               // blocked before dispatch, see usePromoValidation
  appliedGiftCard:     null,
  appliedGiftVoucher:  null,
  discountAmount:      0,     // sum of appliedPromos[].discountAmount
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

    // Apply a validated promo code and its discount — appends to the list.
    // "Similar" (same discount-type) conflicts are checked before dispatch
    // (see usePromoValidation); this only guards against the exact same
    // code being added twice.
    applyPromo: (state, action) => {
      const { promoCode, promoDetails, discountAmount } = action.payload;
      const alreadyApplied = state.appliedPromos.some((p) => p.promoCode === promoCode);
      if (alreadyApplied) return;

      state.appliedPromos.push({ promoCode, promoDetails, discountAmount });
      state.discountAmount = state.appliedPromos.reduce((sum, p) => sum + p.discountAmount, 0);
      recalculateTotals(state);
    },

    // Remove one applied promo by code
    removePromo: (state, action) => {
      const promoCode = action.payload;
      state.appliedPromos  = state.appliedPromos.filter((p) => p.promoCode !== promoCode);
      state.discountAmount = state.appliedPromos.reduce((sum, p) => sum + p.discountAmount, 0);
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

  // Redux Persist rehydration migration: a cart persisted before multi-promo
  // support existed has appliedPromoCode/appliedPromoDetails (singular) and
  // no appliedPromos array at all — without this, the first push()/reduce()
  // call on the missing array would throw. Migrates the old single promo
  // into the new array shape so an in-progress cart isn't lost on upgrade.
  extraReducers: (builder) => {
    builder.addCase(REHYDRATE, (state, action) => {
      const persistedCart = action.payload?.cart;
      if (!persistedCart) return;

      if (Array.isArray(persistedCart.appliedPromos)) {
        state.appliedPromos = persistedCart.appliedPromos;
      } else if (persistedCart.appliedPromoCode) {
        state.appliedPromos = [{
          promoCode:      persistedCart.appliedPromoCode,
          promoDetails:   persistedCart.appliedPromoDetails ?? null,
          discountAmount: persistedCart.discountAmount ?? 0,
        }];
      } else {
        state.appliedPromos = [];
      }
    });
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
export const selectAppliedPromos      = (state) => state.cart.appliedPromos;
export const selectIsCartEmpty        = (state) => state.cart.items.length === 0;

export default cartSlice.reducer;