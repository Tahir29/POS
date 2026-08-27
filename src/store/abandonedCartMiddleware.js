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
//        b. The live cart is NOT empty (items carried over from a customer
//           switch — see CustomerSessionSheet's "Keep Cart" option) → that
//           cart now belongs to the newly-attached customer, so save it
//           under THEIR party_id right away rather than waiting for the
//           next add/remove to trigger a save.
//
//   2. Any cart-mutating action (add/remove/qty/promo/gift card/voucher/
//      fulfillment-hydrate) while a customer is attached → debounced save
//      of the current cart snapshot to Mongo. Debounced so tapping +/- on
//      quantity five times doesn't fire five network calls.
//
//   3. cart/detachCustomer — if "Keep Cart" was chosen (items remain in a
//      now-customerless cart), snapshot them under the OUTGOING customer
//      before that history has any chance of being silently overwritten by
//      whatever uses this cart next (a new guest sale, a different
//      customer). Reads the PRE-action state, not post — by the time this
//      case runs, the reducer has already nulled cart.customerId.
//
//   4. cart/clearCart — fires on BOTH a completed sale and a manual
//      "Clear Cart" (see checkout/page.jsx and CustomerSessionSheet). Either
//      way the cart is no longer pending, so delete whatever was saved —
//      there's nothing left to call abandoned. Also reads pre-action state
//      for the same reason as #3.

import { toast } from 'react-toastify';
import { setAbandonedCart, clearAbandonedCartState } from './slices/abandonedCartSlice';
import { restoreCart } from './slices/cartSlice';

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
          // Items already in the cart at attach time — carried over from a
          // "Keep Cart" switch. They belong to this customer now.
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
      // preserved, not discarded. Every other clearCart() caller (a
      // completed sale in checkout/page.jsx, or the explicit "Clear Cart"
      // button in CustomerSessionSheet) means the cart really is resolved,
      // so the default (no reason) behavior stays "delete".
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
