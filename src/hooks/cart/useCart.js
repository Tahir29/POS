// src/hooks/cart/useCart.js
// Full cart state + actions. Single hook for CartDrawer and its children.

import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
  selectCartItems,
  selectCartCustomerId,
  selectCartCustomerName,
  selectCartCustomerMobile,
  selectAppliedPromos,
  selectRedeemedCoins,
  selectIsCartEmpty,
  selectFulfillmentOrderId,
  selectFulfillmentOrderNo,
  removeItem,
  updateQuantity,
  attachCustomer,
  detachCustomer,
  applyPromo,
  removePromo,
  applyLoyaltyCoins,
  removeLoyaltyCoins,
  clearCart,
  clearCartKeepCustomer,
  hydrateFromOrder,
} from '@/store/slices/cartSlice';
import { mapFulfillmentLineToCartItem } from '@/services/orderFulfillmentService';
import TOAST from '@/constants/toastMessages';

export function useCart() {
  const dispatch = useDispatch();

  const items               = useSelector(selectCartItems);
  const customerId          = useSelector(selectCartCustomerId);
  const customerName        = useSelector(selectCartCustomerName);
  const customerMobile      = useSelector(selectCartCustomerMobile);
  const appliedPromos       = useSelector(selectAppliedPromos);
  const redeemedCoins       = useSelector(selectRedeemedCoins);
  const isEmpty             = useSelector(selectIsCartEmpty);
  const fulfillmentOrderId  = useSelector(selectFulfillmentOrderId);
  const fulfillmentOrderNo  = useSelector(selectFulfillmentOrderNo);

  const handleRemoveItem = (item) => {
    dispatch(removeItem({
      itemId:  item.itemId,
      sizeId:  item.sizeId,
      styleId: item.styleId,
    }));
    toast.success(TOAST.CART.ITEM_REMOVED(item.itemName ?? 'Item'));
  };

  const handleUpdateQuantity = (item, quantity) => {
    if (quantity <= 0) {
      handleRemoveItem(item);
      return;
    }
    dispatch(updateQuantity({
      itemId:  item.itemId,
      sizeId:  item.sizeId,
      styleId: item.styleId,
      quantity,
    }));
  };

  const handleAttachCustomer = (customer) => {
    dispatch(attachCustomer(customer));
    toast.success(TOAST.CUSTOMER.FOUND(customer.customerName ?? 'Customer'));
  };

  const handleDetachCustomer = () => {
    dispatch(detachCustomer());
    toast.success(TOAST.CUSTOMER.DETACHED(customerName ?? 'Customer'));
  };

  const handleApplyPromo = (promo) => {
    dispatch(applyPromo(promo));
    toast.success(TOAST.CART.PROMO_APPLIED(promo.promoCode));
  };

  const handleRemovePromo = (promoCode) => {
    dispatch(removePromo(promoCode));
    toast.success(TOAST.CART.PROMO_REMOVED);
  };

  // Mutual exclusivity with promos is checked HERE (synchronous, no server
  // call needed — unlike a promo code, an amount doesn't need validating
  // against OrnaVerse) rather than via a dedicated hook the way promos use
  // usePromoValidation. The reverse guard (blocking a promo while coins are
  // applied) lives in usePromoValidation's own mutationFn instead — see that
  // file. `amount` is expected to already be capped by the caller (see
  // LucraCoinsSection's maxClaimable prop) — this only re-checks it's
  // positive, it doesn't re-derive the cap itself.
  const handleApplyLoyaltyCoins = (amount) => {
    if (appliedPromos.length > 0) {
      toast.error(TOAST.CART.COINS_BLOCKED_BY_PROMO);
      return;
    }
    if (!(amount > 0)) return;
    dispatch(applyLoyaltyCoins(amount));
    toast.success(TOAST.CART.COINS_APPLIED(amount));
  };

  const handleRemoveLoyaltyCoins = () => {
    dispatch(removeLoyaltyCoins());
    toast.success(TOAST.CART.COINS_REMOVED);
  };

  const handleClearCart = () => {
    dispatch(clearCart());
    toast.success(TOAST.CART.CART_CLEARED);
  };

  // ADDED 2026-09-07 — used only by checkout/page.jsx right after a
  // successful order/invoice. Explicit product decision: completing a sale
  // must not silently detach the customer — only a manual "Remove"
  // (detachCustomer) or the agent's own logout should end that session. No
  // toast here (unlike handleClearCart above) — this runs as an internal
  // cleanup step right before the redirect to /order-success, not a
  // user-initiated action that needs its own confirmation.
  const handleClearCartKeepCustomer = () => {
    dispatch(clearCartKeepCustomer());
  };

  // "Fulfill from order" — replaces the whole cart with an order's own
  // customer + selected ready-to-invoice line(s). See cartSlice's
  // hydrateFromOrder and orderFulfillmentService.js for the full contract —
  // CONFIRMED LIVE 2026-09-08 that this closes the source order out
  // server-side, via checkoutPricingService.claimStockPieces claiming the
  // exact reserved stock piece (fulfillmentItemLineNo), not a header field.
  //
  // @param {{ order: { partyId, partyName, mobile, transactionId, documentNo },
  //   lines: object[] }} params — lines are raw rows from
  //   getReadyToInvoiceLines/getAllOpenOrderLines
  const handleLoadFromOrder = ({ order, lines }) => {
    const items = lines.map(mapFulfillmentLineToCartItem);
    dispatch(hydrateFromOrder({
      items,
      customerId:         order.partyId,
      customerName:       order.partyName,
      customerMobile:     order.mobile,
      fulfillmentOrderId: order.transactionId,
      fulfillmentOrderNo: order.documentNo,
    }));
    toast.success(TOAST.CART.LOADED_FROM_ORDER(order.documentNo));
  };

  return {
    items,
    customerId,
    customerName,
    customerMobile,
    appliedPromos,
    redeemedCoins,
    isEmpty,
    fulfillmentOrderId,
    fulfillmentOrderNo,
    removeItem: handleRemoveItem,
    updateQuantity: handleUpdateQuantity,
    attachCustomer: handleAttachCustomer,
    detachCustomer: handleDetachCustomer,
    applyPromo: handleApplyPromo,
    removePromo: handleRemovePromo,
    applyLoyaltyCoins: handleApplyLoyaltyCoins,
    removeLoyaltyCoins: handleRemoveLoyaltyCoins,
    clearCart: handleClearCart,
    clearCartKeepCustomer: handleClearCartKeepCustomer,
    loadFromOrder: handleLoadFromOrder,
  };
}