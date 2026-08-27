// src/store/recentlyViewedMiddleware.js
//
// All the async side-effects for the recently-viewed feature live here, not
// in components or in the slice — same split as analyticsMiddleware.js and
// for the same reason: attachCustomer/detachCustomer are dispatched from
// more than one place (useCustomerSession.js AND useCart.js directly), so
// catching them at the action level guarantees this fires exactly once
// regardless of which call site triggered it, instead of needing the same
// fetch/clear logic copy-pasted into every attach/detach call site.
//
// Three responsibilities:
//   1. cart/attachCustomer  → fetch this customer's history from Mongo,
//      hydrate the slice with it.
//   2. cart/detachCustomer  → clear the slice — the NEXT customer attached
//      at this terminal must never see a previous customer's history.
//   3. recentlyViewed/addRecentlyViewedItem → persist that one view to
//      Mongo (fire-and-forget, same pattern as
//      useCustomerLookup.js's syncCustomerProfile — never blocks the UI,
//      never surfaces an error to the operator).
//
// Also handles REHYDRATE: cart IS in persistConfig's whitelist, but
// recentlyViewed deliberately is NOT (see that slice's header comment) — so
// a hard refresh with a customer already attached would otherwise leave
// the carousel empty until the NEXT attach/detach cycle. Checking
// action.payload?.cart?.customerId on REHYDRATE closes that gap.

import { REHYDRATE } from 'redux-persist';
import { hydrateRecentlyViewed, clearRecentlyViewed } from './slices/recentlyViewedSlice';

async function fetchRecentlyViewed(partyId, token) {
  try {
    const res = await fetch(`/api/customers/recently-viewed?party_id=${partyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.items) ? data.items : [];
  } catch (err) {
    console.warn('[recentlyViewedMiddleware] fetch failed', err);
    return [];
  }
}

function recordView(partyId, customerName, customerMobile, item, token) {
  fetch('/api/customers/recently-viewed', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body:    JSON.stringify({ party_id: partyId, customerName, customerMobile, item }),
  }).catch((err) => console.warn('[recentlyViewedMiddleware] record view failed', err));
}

export const recentlyViewedMiddleware = (store) => (next) => (action) => {
  const result = next(action);

  switch (action.type) {
    case REHYDRATE: {
      const persistedCart = action.payload?.cart;
      const persistedAuth = action.payload?.auth;
      const customerId = persistedCart?.customerId;
      const token       = persistedAuth?.accessToken;
      if (!customerId || !token) break;

      fetchRecentlyViewed(customerId, token).then((items) => {
        store.dispatch(hydrateRecentlyViewed(items));
      });
      break;
    }

    case 'cart/attachCustomer': {
      const { customerId } = action.payload;
      const token = store.getState().auth?.accessToken;
      if (!customerId || !token) break;

      fetchRecentlyViewed(customerId, token).then((items) => {
        store.dispatch(hydrateRecentlyViewed(items));
      });
      break;
    }

    case 'cart/detachCustomer': {
      store.dispatch(clearRecentlyViewed());
      break;
    }

    case 'recentlyViewed/addRecentlyViewedItem': {
      const state = store.getState();
      const { customerId, customerName, customerMobile } = state.cart;
      const token = state.auth?.accessToken;
      if (!customerId || !token) break; // shouldn't happen — the hook that dispatches this already checks isAttached

      recordView(customerId, customerName, customerMobile, action.payload, token);
      break;
    }

    default:
      break;
  }

  return result;
};
