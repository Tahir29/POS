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

export const analyticsMiddleware = (store) => (next) => (action) => {
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
      tracker.track(EVENTS.CUSTOMER_DETACHED, {});
      break;
    }

    case 'cart/removeItem': {
      tracker.track(EVENTS.CART_ITEM_REMOVED, action.payload);
      break;
    }

    case 'cart/updateQuantity': {
      tracker.track(EVENTS.CART_ITEM_QTY_CHANGED, action.payload);
      break;
    }

    case 'cart/clearCart': {
      tracker.track(EVENTS.CART_CLEARED, {});
      break;
    }

    case 'cart/applyPromo': {
      // Only the identifying fields — promoDetails is the full promotion
      // entity and too large/noisy to send as an event property.
      const { promoCode, discountAmount } = action.payload;
      tracker.track(EVENTS.PROMO_APPLIED, { promoCode, discountAmount });
      break;
    }

    default:
      break;
  }

  return result;
};
