// src/store/analyticsMiddleware.js
//
// Tracks cart/customer actions at the Redux level rather than inside
// individual hooks — there are two separate call paths that dispatch
// attachCustomer/detachCustomer (useCustomerSession.js AND useCart.js),
// and before this middleware only one of them (useCustomerSession) fired
// analytics. A component-level fix would need to be applied in both places
// and again in every future call site; catching it here at the action
// level guarantees every dispatch is tracked exactly once, regardless of
// which hook/component triggered it.

import tracker from '@/lib/analytics/tracker';
import EVENTS from '@/lib/analytics/events';
import { getPromotionDiscountType } from '@/lib/normalizers/promotion';

// Finds the full cart line a removeItem/updateQuantity action refers to,
// in the PRE-dispatch cart (see preCart below — same reasoning as
// 'cart/detachCustomer': the reducer has already applied the change by the
// time this middleware runs, so anything about to be REMOVED/CHANGED has
// to be read from state captured before next(action)). Returns the whole
// line (including its full `attributes`, see AddToCartButton.jsx/
// productAttributes.js) so CART_ITEM_REMOVED/CART_ITEM_QTY_CHANGED carry
// the same product detail every other product event does, not just the
// bare itemId/sizeId/styleId identifiers the action payload itself has.
function findCartItem(preCart, { itemId, sizeId, styleId }) {
  return preCart?.items?.find(
    (i) => i.itemId === itemId && i.sizeId === sizeId && i.styleId === styleId
  ) ?? null;
}

export const analyticsMiddleware = (store) => (next) => (action) => {
  // Captured BEFORE next(action) runs — needed for 'cart/detachCustomer'
  // below (see that case's own comment). detachCustomer's action carries no
  // payload of its own, and the reducer resets cart to initialState
  // synchronously, so this is the only point at which the OUTGOING
  // customer's identity is still readable at all.
  const preCart = store.getState().cart;

  const result = next(action);

  switch (action.type) {
    case 'cart/attachCustomer': {
      const state = store.getState();
      const { customerId, customerName, customerMobile } = action.payload;
      tracker.startSession({
        customerId,
        customerName,
        customerMobile,
        agentUsername: state.auth?.user?.username ?? null,
        storeId:        state.store?.activeStoreId   ?? null,
        storeName:      state.store?.activeStoreName ?? null,
        storeCode:      state.store?.activeStoreCode ?? null,
      });
      break;
    }

    case 'cart/detachCustomer': {
      tracker.endSession('manual');
      // FIXED 2026-09-04 — confirmed: endSession() above already clears the
      // tracker's own session (sessionStorage) before returning, so by the
      // time this ran with an empty properties object, track()'s own
      // session-derived customer_id had nothing left to read — this event,
      // whose entire purpose is recording WHO got detached, always fired
      // with no customer identity at all. preCart (captured pre-dispatch,
      // above) is the only place that's still available.
      tracker.track(EVENTS.CUSTOMER_DETACHED, {
        customer_id: preCart?.customerId ?? undefined,
      });
      break;
    }

    // ENRICHED 2026-09-08 — this used to send only the bare
    // { itemId, sizeId, styleId } identifiers the action payload carries —
    // no name, price, image, or any of the product detail every other
    // product event now has (see productAttributes.js). The full line is
    // looked up out of preCart (captured before the reducer removed it —
    // same reasoning as 'cart/detachCustomer' above) rather than re-derived.
    case 'cart/removeItem': {
      const item = findCartItem(preCart, action.payload);
      tracker.track(EVENTS.CART_ITEM_REMOVED, {
        ...action.payload,
        item_name:  item?.itemName ?? null,
        unit_price: item?.unitPrice ?? null,
        quantity:   item?.quantity ?? null,
        image:      item?.image ?? null,
        ...item?.attributes,
      });
      break;
    }

    case 'cart/updateQuantity': {
      const item = findCartItem(preCart, action.payload);
      // action.payload already carries the NEW quantity — nothing here
      // overrides it (item.attributes has no quantity field of its own).
      tracker.track(EVENTS.CART_ITEM_QTY_CHANGED, {
        ...action.payload,
        item_name:  item?.itemName ?? null,
        unit_price: item?.unitPrice ?? null,
        ...item?.attributes,
      });
      break;
    }

    // ADDED 2026-09-08 — EVENTS.CART_OPENED existed but had zero call
    // sites (confirmed by audit): AddToCartButton.jsx and Header's cart
    // badge both dispatch ui/openCart directly, never their own tracker
    // call — caught here at the action level instead, same reasoning as
    // every other case in this file, so it fires regardless of which of
    // the two call sites triggered it.
    case 'ui/openCart': {
      const state = store.getState();
      tracker.track(EVENTS.CART_OPENED, {
        item_count: state.cart?.items?.length ?? 0,
        value:      state.cart?.total ?? null,
        store_id:   state.store?.activeStoreId ?? null,
      });
      break;
    }

    case 'cart/clearCart': {
      // ENRICHED 2026-09-04 — this fired with an always-empty properties
      // object, even though the action's own payload distinguishes WHY the
      // cart was cleared (a completed sale, an explicit Clear Cart tap, or
      // logout's 'session_reset' — see abandonedCartMiddleware's own
      // 'cart/clearCart' case, which already reads this same field to
      // decide save-vs-delete). Reporting it here too means a GA4/WebEngage
      // funnel can tell "abandoned mid-sale" apart from "sale completed
      // normally" instead of seeing one undifferentiated CART_CLEARED.
      tracker.track(EVENTS.CART_CLEARED, {
        reason: action.payload?.reason ?? 'manual',
        item_count: preCart?.items?.length ?? undefined,
      });
      break;
    }

    case 'cart/applyPromo': {
      // Only the identifying fields — promoDetails is the full promotion
      // entity and too large/noisy to send as an event property.
      const { promoCode, discountAmount, promoDetails } = action.payload;
      tracker.track(EVENTS.PROMO_APPLIED, {
        promoCode,
        discountAmount,
        // ENRICHED 2026-09-04 — discountType (%-off vs flat-₹-off) was
        // available on promoDetails all along but never surfaced; it's what
        // usePromoValidation.js's own "similar promo" check groups by (same
        // shared helper), so it's exactly the dimension a real funnel
        // report would want here.
        discountType: promoDetails ? getPromotionDiscountType(promoDetails) : undefined,
      });
      break;
    }

    // ADDED 2026-09-08 — mirrors 'cart/applyPromo' above (no 'removeLoyaltyCoins'
    // case, same as there being no 'removePromo' case — only application is
    // tracked here).
    case 'cart/applyLoyaltyCoins': {
      tracker.track(EVENTS.COINS_APPLIED, { amount: action.payload });
      break;
    }

    default:
      break;
  }

  return result;
};
