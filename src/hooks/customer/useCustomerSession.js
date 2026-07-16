// src/hooks/customer/useCustomerSession.js
// Wraps cart.customerId/customerName/customerMobile + attach/detach actions.
//
// Analytics for attach/detach is handled centrally by
// src/store/analyticsMiddleware.js (keyed off the cart/attachCustomer and
// cart/detachCustomer action types) rather than here — useCart.js dispatches
// the same two actions directly, bypassing this hook entirely, so tracking
// it at the action level is the only way to catch both call paths.

import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
  selectCartCustomerId,
  selectCartCustomerName,
  selectCartCustomerMobile,
  attachCustomer,
  detachCustomer,
} from '@/store/slices/cartSlice';
import TOAST   from '@/constants/toastMessages';

export function useCustomerSession() {
  const dispatch = useDispatch();

  const customerId     = useSelector(selectCartCustomerId);
  const customerName   = useSelector(selectCartCustomerName);
  const customerMobile = useSelector(selectCartCustomerMobile);

  const isAttached = !!customerId;

  /**
   * @param {{ customerId: number, customerName: string, customerMobile: string }} customer
   * @param {{ silent?: boolean }} [options]
   */
  const attach = (customer, options = {}) => {
    dispatch(attachCustomer(customer));

    if (!options.silent) {
      toast.success(TOAST.CUSTOMER.FOUND(customer.customerName ?? 'Customer'));
    }
  };

  const detach = () => {
    const name = customerName ?? 'Customer';
    dispatch(detachCustomer());
    toast.success(TOAST.CUSTOMER.DETACHED(name));
  };

  return {
    customerId,
    customerName,
    customerMobile,
    isAttached,
    attach,
    detach,
  };
}