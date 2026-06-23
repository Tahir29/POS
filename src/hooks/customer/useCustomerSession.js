// src/hooks/customer/useCustomerSession.js
// Wraps cart.customerId/customerName/customerMobile + attach/detach actions.
// Starts/ends analytics session when customer is attached/detached.

import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
  selectCartCustomerId,
  selectCartCustomerName,
  selectCartCustomerMobile,
  attachCustomer,
  detachCustomer,
} from '@/store/slices/cartSlice';
import {
  selectAuthUser,
} from '@/store/slices/authSlice';
import {
  selectActiveStoreId,
  selectActiveStoreName,
  selectActiveStoreCode,
} from '@/store/slices/storeSlice';
import TOAST   from '@/constants/toastMessages';
import tracker from '@/lib/analytics/tracker';
import EVENTS  from '@/lib/analytics/events';

export function useCustomerSession() {
  const dispatch = useDispatch();

  const customerId     = useSelector(selectCartCustomerId);
  const customerName   = useSelector(selectCartCustomerName);
  const customerMobile = useSelector(selectCartCustomerMobile);
  const user           = useSelector(selectAuthUser);
  const storeId        = useSelector(selectActiveStoreId);
  const storeName      = useSelector(selectActiveStoreName);
  const storeCode      = useSelector(selectActiveStoreCode);

  const isAttached = !!customerId;

  /**
   * @param {{ customerId: number, customerName: string, customerMobile: string }} customer
   * @param {{ silent?: boolean }} [options]
   */
  const attach = (customer, options = {}) => {
    dispatch(attachCustomer(customer));

    // ── Start customer analytics session ──────────────────
    tracker.startSession({
      customerId:     customer.customerId,
      customerName:   customer.customerName,
      customerMobile: customer.customerMobile,
      agentUsername:   user?.username ?? null,
      storeId,
      storeName,
      storeCode,
    });

    if (!options.silent) {
      toast.success(TOAST.CUSTOMER.FOUND(customer.customerName ?? 'Customer'));
    }
  };

  const detach = () => {
    const name = customerName ?? 'Customer';

    // ── End customer analytics session ────────────────────
    tracker.endSession('manual');

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