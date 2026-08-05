// src/store/slices/cartSlice.js
// Manages the shopping cart — items, customer, promos, totals.
// Persisted via Redux Persist (survives page refresh — offline resilience).
// All pricing comes from OrnaVerse API — no independent price computation.

import { createSlice } from '@reduxjs/toolkit';
import { REHYDRATE } from 'redux-persist';
import APP_CONFIG from '@/constants/appConfig';
import { computePromotionDiscount } from '@/lib/normalizers/promotion';

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
  taxAmount:           0,     // 3% GST on the taxable value (subtotal - discount)
  total:               0,
};

// ── HELPERS ──────────────────────────────────────────────────
// Recalculates subtotal, discount, tax and total after any cart mutation.
// Called at the end of every reducer that modifies items or promos.
//
// DISCOUNT IS RECOMPUTED HERE, NOT TRUSTED FROM THE PROMO PAYLOAD — a
// percentage promo is "X% of the subtotal", not a fixed rupee figure. It used
// to be computed once, when the promo was applied, and stored as a frozen
// amount that never changed again — so adding/removing items (or just the
// subtotal moving) after applying a promo silently drifted the discount away
// from the promised percentage. Recomputing on every mutation keeps it
// correct against whatever the subtotal is right now. (Checkout goes
// further still: it recomputes AGAIN against the real stock-piece subtotal,
// which can differ from this catalog-based one — see useCheckoutPricing.)
const recalculateTotals = (state) => {
  state.subtotal = state.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  state.appliedPromos = state.appliedPromos.map((p) => ({
    ...p,
    discountAmount: computePromotionDiscount(p.promoDetails, state.subtotal),
  }));
  state.discountAmount = state.appliedPromos.reduce((sum, p) => sum + p.discountAmount, 0);

  const taxableValue = Math.max(0, state.subtotal - state.discountAmount);
  state.taxAmount = +(taxableValue * APP_CONFIG.TAX.GST_RATE).toFixed(2);
  state.total = +(taxableValue + state.taxAmount).toFixed(2);
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

    // Apply a validated promo code — appends to the list. discountAmount is
    // NOT trusted from the payload; recalculateTotals computes it fresh
    // against the current subtotal (and keeps it fresh afterward too). This
    // only guards against the exact same code being added twice — "similar"
    // (same discount-type) conflicts are checked before dispatch, see
    // usePromoValidation.
    applyPromo: (state, action) => {
      const { promoCode, promoDetails } = action.payload;
      const alreadyApplied = state.appliedPromos.some((p) => p.promoCode === promoCode);
      if (alreadyApplied) return;

      state.appliedPromos.push({ promoCode, promoDetails, discountAmount: 0 });
      recalculateTotals(state);
    },

    // Remove one applied promo by code
    removePromo: (state, action) => {
      const promoCode = action.payload;
      state.appliedPromos = state.appliedPromos.filter((p) => p.promoCode !== promoCode);
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
  //
  // MUST return the whole slice, not mutate one field. The previous version
  // only assigned state.appliedPromos, and the rest of the persisted cart —
  // items and the attached customer — never made it back. Symptom: a hard
  // refresh mid-sale emptied the basket and dropped the customer, then wrote
  // the empty cart back over the good one. Verified 2026-08-01: auth and
  // store rehydrated fine; cart was the only slice with a REHYDRATE handler,
  // and the only one that lost its state.
  extraReducers: (builder) => {
    builder.addCase(REHYDRATE, (state, action) => {
      const persistedCart = action.payload?.cart;
      if (!persistedCart) return state;

      let appliedPromos;
      if (Array.isArray(persistedCart.appliedPromos)) {
        appliedPromos = persistedCart.appliedPromos;
      } else if (persistedCart.appliedPromoCode) {
        appliedPromos = [{
          promoCode:      persistedCart.appliedPromoCode,
          promoDetails:   persistedCart.appliedPromoDetails ?? null,
          discountAmount: persistedCart.discountAmount ?? 0,
        }];
      } else {
        appliedPromos = [];
      }

      const merged = { ...state, ...persistedCart, appliedPromos };
      // Re-derive rather than trust the persisted figures verbatim — cheap
      // insurance that a cart resumed after a refresh has self-consistent
      // totals even if it was persisted mid-recompute.
      recalculateTotals(merged);
      return merged;
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
export const selectCartTax            = (state) => state.cart.taxAmount;
export const selectCartTotal          = (state) => state.cart.total;
export const selectCartDiscount       = (state) => state.cart.discountAmount;
export const selectCartCustomerId     = (state) => state.cart.customerId;
export const selectCartCustomerName   = (state) => state.cart.customerName;
export const selectCartCustomerMobile = (state) => state.cart.customerMobile;
export const selectCartCustomerAddress = (state) => state.cart.customerAddress;
export const selectAppliedPromos      = (state) => state.cart.appliedPromos;
export const selectIsCartEmpty        = (state) => state.cart.items.length === 0;

export default cartSlice.reducer;