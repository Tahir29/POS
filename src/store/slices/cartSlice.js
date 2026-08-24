// src/store/slices/cartSlice.js
// Manages the shopping cart — items, customer, promos, totals.
// Persisted via Redux Persist (survives page refresh — offline resilience).
// All pricing comes from OrnaVerse API — no independent price computation.

import { createSlice } from '@reduxjs/toolkit';
import { REHYDRATE } from 'redux-persist';
import APP_CONFIG from '@/constants/appConfig';

const initialState = {
  items:               [],    // CartItem[]
  customerId:          null,
  customerName:        null,
  customerMobile:      null,
  customerAddress:     null,  // { address, address1, city, state, country, zip } — used as
                               // shipping_address/billing_address at order creation
  appliedPromos:       [],    // { promoCode, promoDetails, discountAmount }[] — multiple
                               // promos can stack; "similar" (same discount type) ones are
                               // blocked before dispatch, see usePromoValidation.
                               // discountAmount here is DERIVED (see recalculateTotals),
                               // display-only, and against the CART subtotal.
  appliedGiftCard:     null,
  appliedGiftVoucher:  null,
  discountAmount:      0,     // derived from appliedPromos against the current subtotal
  subtotal:            0,
  taxAmount:           0,     // 3% GST on the taxable value (subtotal - discount)
  total:               0,
  // Set only when this cart was loaded via "Fulfill from order" (see
  // useOrderFulfillment.js / hydrateFromOrder below) — carried through to
  // Invoice/Create as a best-effort reference back to the source order.
  // UNVERIFIED whether OrnaVerse's backend actually uses these to close the
  // order out; see the header comment on API.ORDER_FULFILLMENT.
  fulfillmentOrderId:  null,
  fulfillmentOrderNo:  null,
};

// Recalculates subtotal, tax and total after any cart mutation.
//
// THE CART DOES NOT KNOW WHAT A PROMOTION IS WORTH, and no longer pretends
// to. Captured from OrnaVerse's own counter 2026-08-05: a promotion's
// percentage applies to a COMPONENT of the item chosen by `discount_calc_on`
// — the diamond value, the making charges, or the whole value. "20% Off
// Diamond" on a ₹1,04,699 piece is 20% of its ₹60,888 of diamond, not of the
// subtotal. Only Helper/ApplyPromotions, over server-priced line items, can
// work that out, and it re-taxes the line afterwards.
//
// So `discountAmount` stays 0 here and the cart shows the promo as applied
// without a rupee figure. The real number appears at checkout, from the
// server (see useCheckoutPricing). Inventing one here produced a saving the
// customer was then not given — worse than showing none.
const recalculateTotals = (state) => {
  state.subtotal = state.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  state.discountAmount = 0;
  state.appliedPromos = state.appliedPromos.map((promo) => ({
    ...promo,
    discountAmount: 0,
  }));

  state.taxAmount = +(state.subtotal * APP_CONFIG.TAX.GST_RATE).toFixed(2);
  state.total = +(state.subtotal + state.taxAmount).toFixed(2);
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {

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

    attachCustomer: (state, action) => {
      const { customerId, customerName, customerMobile, customerAddress } = action.payload;
      state.customerId      = customerId;
      state.customerName    = customerName;
      state.customerMobile  = customerMobile;
      state.customerAddress = customerAddress ?? null;
    },

    // Full reset, not just the customer fields (2026-08-24) — a detach means
    // this customer's session with the POS is over. Whatever was in the cart
    // is exactly what abandonedCartMiddleware's own 'cart/detachCustomer'
    // case just snapshotted to Mongo under this customer (it reads
    // PRE-action state, so it already captured the items by the time this
    // runs) — so nothing is lost, and leaving them sitting in a now-
    // customerless cart would only mean stale items silently carrying into
    // whatever uses this cart next (a new guest sale, a different
    // customer). Re-attaching this same customer later restores them from
    // that Mongo snapshot (see the middleware's 'cart/attachCustomer' case).
    detachCustomer: () => {
      return initialState;
    },

    // Apply a validated promo code and its discount — appends to the list.
    // "Similar" (same discount-type) conflicts are checked before dispatch
    // (see usePromoValidation); this only guards against the exact same
    // code being added twice.
    // The payload's discountAmount is deliberately ignored — recalculateTotals
    // derives it from promoDetails against the live subtotal. It stays on the
    // action only because the analytics middleware reports it.
    applyPromo: (state, action) => {
      const { promoCode, promoDetails } = action.payload;
      const alreadyApplied = state.appliedPromos.some((p) => p.promoCode === promoCode);
      if (alreadyApplied) return;

      state.appliedPromos.push({ promoCode, promoDetails, discountAmount: 0 });
      recalculateTotals(state);
    },

    removePromo: (state, action) => {
      const promoCode = action.payload;
      state.appliedPromos = state.appliedPromos.filter((p) => p.promoCode !== promoCode);
      recalculateTotals(state);
    },

    applyGiftCard: (state, action) => {
      state.appliedGiftCard = action.payload;
    },

    applyGiftVoucher: (state, action) => {
      state.appliedGiftVoucher = action.payload;
    },

    // Clear the entire cart — called after successful order creation
    clearCart: (state) => {
      return initialState;
    },

    // Restores a previously-abandoned cart (see store/abandonedCartMiddleware.js)
    // once a customer with one attaches to an empty cart. Deliberately only
    // touches items + totals — customerId/Name/Mobile are already correct
    // from the attach that triggered this, and there's no fulfillment
    // reference to carry (unlike hydrateFromOrder, this isn't tied to a
    // specific OrnaVerse order). unitPrice on these items is whatever was
    // last shown in the cart, same "display estimate, re-priced live at
    // checkout" caveat every other cart item already carries — nothing
    // about a restored item bypasses that.
    restoreCart: (state, action) => {
      state.items = action.payload.items ?? [];
      recalculateTotals(state);
    },

    // "Fulfill from order" — replaces the ENTIRE cart wholesale (not a merge;
    // any in-progress cart for a different customer would make no sense
    // mixed with a fulfillment) with the order's own customer + selected
    // ready-to-invoice line(s), tagged with fulfillmentOrderId/OrderNo so
    // useCreateInvoice can reference the source order at submission time.
    // See useOrderFulfillment.js and the header comment on
    // API.ORDER_FULFILLMENT for what's confirmed vs. still unverified about
    // that reference actually closing the order out server-side.
    //
    // unitPrice on these items is a DISPLAY ESTIMATE ONLY (net_amount / pieces
    // from the order line) — buildPricedLineItems re-prices and re-claims a
    // physical stock piece against TODAY's rates at submission, exactly as
    // it does for any other cart item; nothing about this bypasses that.
    hydrateFromOrder: (state, action) => {
      const { items, customerId, customerName, customerMobile, fulfillmentOrderId, fulfillmentOrderNo } = action.payload;
      const next = {
        ...initialState,
        items,
        customerId, customerName, customerMobile,
        fulfillmentOrderId, fulfillmentOrderNo,
      };
      recalculateTotals(next);
      return next;
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

      // Recompute rather than trust the persisted subtotal/discount/total. A
      // cart persisted before the discount became derived carries a frozen
      // figure costed against whatever the subtotal was when the promo was
      // typed in; restoring it verbatim would put a stale discount straight
      // back into a live basket.
      const rehydrated = { ...state, ...persistedCart, appliedPromos };
      recalculateTotals(rehydrated);
      return rehydrated;
    });
  },
});

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
  restoreCart,
  hydrateFromOrder,
} = cartSlice.actions;

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
export const selectFulfillmentOrderId = (state) => state.cart.fulfillmentOrderId;
export const selectFulfillmentOrderNo = (state) => state.cart.fulfillmentOrderNo;

export default cartSlice.reducer;