// src/store/abandonedCartMiddleware.js
//
// All the async side-effects for the abandoned-cart feature live here, not
// in components or in the slice — same split as analyticsMiddleware.js /
// recentlyViewedMiddleware.js and for the same reason: cart mutations and
// attach/detach are dispatched from more than one call site, so catching
// them at the action level guarantees this fires exactly once regardless
// of which component triggered it.
//
// FOUR responsibilities:
//
//   1. cart/attachCustomer — fetch this customer's saved abandoned cart
//      from Mongo. Two outcomes, mutually exclusive:
//        a. The live cart is EMPTY (the common case) and they have a saved
//           one → restore it straight into the cart (cartSlice.restoreCart)
//           and toast the operator so it's not a silent surprise.
//        b. The live cart is NOT empty — this is now only the
//           re-attaching-the-same-already-attached-customer case (removed
//           2026-09-03: CustomerSessionSheet/customers page used to offer a
//           "Keep Cart" choice that carried a DIFFERENT customer's items
//           into this one; both now always detach — see #3 — before
//           attaching, so a switch never reaches this branch with someone
//           else's items) → save the cart under THEIR party_id right away
//           rather than waiting for the next add/remove to trigger a save.
//
//   2. Any cart-mutating action (add/remove/qty/promo/gift card/voucher/
//      fulfillment-hydrate) while a customer is attached → debounced save
//      of the current cart snapshot to Mongo. Debounced so tapping +/- on
//      quantity five times doesn't fire five network calls.
//
//   3. cart/detachCustomer — always fires on a customer switch now (see #1),
//      not just an explicit "Remove" tap. Snapshot the outgoing customer's
//      items under THEIR OWN party_id before that history has any chance of
//      being silently overwritten by whatever uses this cart next (the
//      incoming customer's attach, a new guest sale). Reads the PRE-action
//      state, not post — by the time this case runs, the reducer has
//      already nulled cart.customerId.
//
//   4. cart/clearCart — the explicit "Clear Cart" button (see
//      CustomerSessionSheet), or useAuth.js's logout() (reason:
//      'session_reset', handled differently — see that case's own
//      comment). Either way the cart is no longer pending, so (outside the
//      logout case) delete whatever was saved — there's nothing left to
//      call abandoned. Also reads pre-action state for the same reason as
//      #3.
//
//   5. cart/clearCartKeepCustomer (added 2026-09-07) — fires after a
//      COMPLETED SALE (see checkout/page.jsx) instead of cart/clearCart,
//      specifically so cartSlice's own reducer keeps the customer attached
//      post-sale. Same "delete the saved record, the cart is resolved"
//      handling as cart/clearCart's default branch — this is a
//      customer-attachment distinction only, not a different cart-resolved
//      outcome.

import { toast } from 'react-toastify';
import { setAbandonedCart, clearAbandonedCartState } from './slices/abandonedCartSlice';
import { restoreCart } from './slices/cartSlice';
import tracker from '@/lib/analytics/tracker';
import EVENTS from '@/lib/analytics/events';

const SAVE_DEBOUNCE_MS = 1500;
let saveTimer = null;

const MUTATING_TYPES = new Set([
  'cart/addItem',
  'cart/removeItem',
  'cart/updateQuantity',
  'cart/applyPromo',
  'cart/removePromo',
  'cart/applyGiftCard',
  'cart/applyGiftVoucher',
  'cart/hydrateFromOrder',
]);

async function fetchAbandonedCart(partyId, token) {
  try {
    const res = await fetch(`/api/customers/abandoned-cart?party_id=${partyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.cart ?? null;
  } catch (err) {
    console.warn('[abandonedCartMiddleware] fetch failed', err);
    return null;
  }
}

function saveAbandonedCart(partyId, cart, token, companyId) {
  fetch('/api/customers/abandoned-cart', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      party_id:       partyId,
      customerName:   cart.customerName,
      customerMobile: cart.customerMobile,
      items:          cart.items,
      subtotal:       cart.subtotal,
      taxAmount:      cart.taxAmount,
      total:          cart.total,
      // Store active at save time (2026-08-27) — so the record carries
      // which store it belongs to instead of that being lost. See
      // storeSlice's activeStoreId, the same value every other feature
      // scopes by.
      company_id:     companyId ?? null,
    }),
  }).catch((err) => console.warn('[abandonedCartMiddleware] save failed', err));

  // ADDED 2026-09-08 — GA4/WebEngage tracking for whatever just got saved
  // to Mongo above, same call every "cart saved as abandoned" path already
  // funnels through (see this file's own header's 4 responsibilities), so
  // this fires exactly once per real save, not a separate guess at when a
  // cart "counts" as abandoned. Items carry their full `attributes` (see
  // AddToCartButton.jsx/productAttributes.js) — the same rich product
  // detail every other cart/product event now has, not just item_id/name.
  tracker.track(EVENTS.CART_ABANDONED, {
    store_id:   companyId ?? null,
    item_count: cart.items.length,
    subtotal:   cart.subtotal ?? null,
    tax_amount: cart.taxAmount ?? null,
    total:      cart.total ?? null,
    currency:   'INR',
  }, {
    customer_id:     partyId,
    customer_name:   cart.customerName,
    customer_mobile: cart.customerMobile,
    items: cart.items.map((item) => ({
      item_id:    item.itemId,
      item_name:  item.itemName,
      item_sku:   item.sku,
      quantity:   item.quantity,
      unit_price: item.unitPrice,
      image:      item.image,
      product_url: item.productUrl,
      ...item.attributes,
    })),
  });
}

function deleteAbandonedCart(partyId, token) {
  fetch(`/api/customers/abandoned-cart?party_id=${partyId}`, {
    method:  'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).catch((err) => console.warn('[abandonedCartMiddleware] delete failed', err));
}

export const abandonedCartMiddleware = (store) => (next) => (action) => {
  // Captured BEFORE next(action) — detachCustomer/clearCart's reducers
  // already wipe customerId/items by the time we'd otherwise inspect
  // state, so the pre-action snapshot is the only place to read "what was
  // this cart, and whose was it" for those two cases.
  const preCart = store.getState().cart;

  const result = next(action);

  const state = store.getState();
  const token = state.auth?.accessToken;
  const companyId = state.store?.activeStoreId;

  switch (action.type) {
    case 'cart/attachCustomer': {
      const { customerId } = action.payload;
      if (!customerId || !token) break;

      fetchAbandonedCart(customerId, token).then((record) => {
        const hasSaved = record && Array.isArray(record.items) && record.items.length > 0;
        store.dispatch(setAbandonedCart(hasSaved ? record : null));

        const freshCart = store.getState().cart;
        // Customer may have detached again before this promise resolved —
        // don't act on stale data for whoever's attached now.
        if (freshCart.customerId !== customerId) return;

        if (freshCart.items.length > 0) {
          // Items already in the cart at attach time — this customer was
          // already attached and had items (re-attach, not a switch: a
          // switch always detaches first — see 'cart/detachCustomer' —
          // so the cart is empty by the time a DIFFERENT customer attaches).
          saveAbandonedCart(customerId, freshCart, token, store.getState().store?.activeStoreId);
        } else if (hasSaved) {
          store.dispatch(restoreCart({ items: record.items }));
          toast.success(
            `Restored ${record.items.length} item${record.items.length === 1 ? '' : 's'} from a previous cart`
          );
        }
      });
      break;
    }

    case 'cart/detachCustomer': {
      if (preCart.customerId && preCart.items.length > 0 && token) {
        saveAbandonedCart(preCart.customerId, preCart, token, companyId);
      }
      store.dispatch(clearAbandonedCartState());
      break;
    }

    case 'cart/clearCart': {
      // reason: 'session_reset' (2026-08-22) — useAuth.js's logout() also
      // dispatches clearCart() to wipe the OPERATOR's local session; that
      // has nothing to do with whether the CUSTOMER's cart was ever
      // resolved. Without this distinction, an operator signing out while
      // a customer had an unpaid cart would delete that customer's saved
      // cart outright — exactly backwards, since an unresolved cart at
      // logout is precisely what "abandoned" means and should be
      // preserved, not discarded. Every other clearCart() caller (the
      // explicit "Clear Cart" button in CustomerSessionSheet) means the
      // cart really is resolved, so the default (no reason) behavior stays
      // "delete". (A completed sale in checkout/page.jsx dispatches
      // 'cart/clearCartKeepCustomer' instead, below — not this action.)
      if (preCart.customerId && token) {
        if (action.payload?.reason === 'session_reset') {
          if (preCart.items.length > 0) saveAbandonedCart(preCart.customerId, preCart, token, companyId);
        } else {
          deleteAbandonedCart(preCart.customerId, token);
        }
      }
      store.dispatch(clearAbandonedCartState());
      break;
    }

    // ADDED 2026-09-07, alongside cartSlice's own clearCartKeepCustomer —
    // checkout/page.jsx now dispatches THIS (not cart/clearCart) after a
    // completed sale, specifically so the reducer keeps the customer
    // attached. That's a cart-state distinction only — it doesn't change
    // whether the cart itself was resolved: a completed sale always means
    // "delete the saved abandoned-cart record," same as cart/clearCart's
    // own default (no-reason) branch above, never a "session_reset"-style
    // save. If this customer adds new items afterward (same attach,
    // now-empty cart), the debounced save in the default case below starts
    // a fresh record for them, same as any other cart activity.
    case 'cart/clearCartKeepCustomer': {
      if (preCart.customerId && token) deleteAbandonedCart(preCart.customerId, token);
      store.dispatch(clearAbandonedCartState());
      break;
    }

    default: {
      if (MUTATING_TYPES.has(action.type)) {
        const { customerId } = state.cart;
        if (!customerId || !token) break;

        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          const latestCart = store.getState().cart;
          if (latestCart.customerId !== customerId) return; // attached customer changed mid-debounce
          if (latestCart.items.length === 0) {
            deleteAbandonedCart(customerId, token);
          } else {
            saveAbandonedCart(customerId, latestCart, token, store.getState().store?.activeStoreId);
          }
        }, SAVE_DEBOUNCE_MS);
      }
    }
  }

  return result;
};
