// src/hooks/cart/useCart.js
// Full cart state + actions. Single hook for CartDrawer and its children.

import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
  selectCartItems,
  selectCartCustomerId,
  selectCartCustomerName,
  selectCartCustomerMobile,
  selectAppliedPromoCode,
  selectAppliedPromoDetails,
  selectIsCartEmpty,
  removeItem,
  updateQuantity,
  attachCustomer,
  detachCustomer,
  applyPromo,
  removePromo,
  clearCart,
} from '@/store/slices/cartSlice';
import TOAST from '@/constants/toastMessages';

export function useCart() {
  const dispatch = useDispatch();

  const items               = useSelector(selectCartItems);
  const customerId          = useSelector(selectCartCustomerId);
  const customerName        = useSelector(selectCartCustomerName);
  const customerMobile      = useSelector(selectCartCustomerMobile);
  const appliedPromoCode    = useSelector(selectAppliedPromoCode);
  const appliedPromoDetails = useSelector(selectAppliedPromoDetails);
  const isEmpty             = useSelector(selectIsCartEmpty);

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

  const handleRemovePromo = () => {
    dispatch(removePromo());
    toast.success(TOAST.CART.PROMO_REMOVED);
  };

  const handleClearCart = () => {
    dispatch(clearCart());
    toast.success(TOAST.CART.CART_CLEARED);
  };

  return {
    items,
    customerId,
    customerName,
    customerMobile,
    appliedPromoCode,
    appliedPromoDetails,
    isEmpty,
    removeItem: handleRemoveItem,
    updateQuantity: handleUpdateQuantity,
    attachCustomer: handleAttachCustomer,
    detachCustomer: handleDetachCustomer,
    applyPromo: handleApplyPromo,
    removePromo: handleRemovePromo,
    clearCart: handleClearCart,
  };
}