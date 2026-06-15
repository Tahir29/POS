'use client';

// src/components/features/customer/CustomerSessionSheet/index.jsx
// BottomSheet-based sheet for the header Customer Session control.
// Flow: lookup by mobile -> show found customer (attach/detach) or
// "not found" -> NewCustomerForm.
//
// Trust/session-hygiene: if the cart already has items when attaching a
// different customer (or a guest cart when attaching anyone), or when
// detaching while items remain, the associate is prompted to clear the
// cart so items never silently carry over between customers.

import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import BottomSheet from '@/components/shared/BottomSheet';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import CustomerLookupInput from '../CustomerLookupInput';
import CustomerDisplayCard from '../CustomerDisplayCard';
import NewCustomerForm from '../NewCustomerForm';
import { Button } from '@/components/ui/button';
import { useCustomerLookup } from '@/hooks/customer/useCustomerLookup';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';
import { useCart } from '@/hooks/cart/useCart';
import TOAST from '@/constants/toastMessages';

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 * }} props
 */
export default function CustomerSessionSheet({ isOpen, onClose }) {
  const [searchMobile, setSearchMobile] = useState(null);
  const [pendingAction, setPendingAction] = useState(null); // { type: 'attach' | 'detach', payload? }

  const session = useCustomerSession();
  const { items, isEmpty, clearCart } = useCart();

  const { customer, isLoading, isError, notFound } = useCustomerLookup(searchMobile, {
    enabled: !!searchMobile,
  });

  // Show a toast once per failed lookup
  useEffect(() => {
    if (isError && searchMobile) {
      toast.error(TOAST.CUSTOMER.LOAD_FAILED);
    }
  }, [isError, searchMobile]);

  const handleSearch = (mobile) => {
    setSearchMobile(mobile);
  };

  // Reset search state whenever the sheet closes, so reopening starts fresh
  const handleClose = () => {
    setSearchMobile(null);
    onClose();
  };

  // Does attaching `incomingCustomerId` risk carrying over someone else's cart?
  const wouldSwitchCustomer = (incomingCustomerId) => {
    if (isEmpty) return false;
    if (!session.isAttached) return true; // guest cart with items
    return session.customerId !== incomingCustomerId;
  };

  const performAttach = (customerToAttach, options) => {
    session.attach(customerToAttach, options);
    handleClose();
  };

  const handleAttachFound = () => {
    if (wouldSwitchCustomer(customer.customerId)) {
      setPendingAction({ type: 'attach', payload: customer, options: undefined });
      return;
    }
    performAttach(customer);
  };

  // Called by NewCustomerForm after a new customer is created
  const handleNewCustomerCreated = (newCustomer) => {
    if (wouldSwitchCustomer(newCustomer.customerId)) {
      setPendingAction({ type: 'attach', payload: newCustomer, options: { silent: true } });
      return;
    }
    performAttach(newCustomer, { silent: true });
  };

  const handleDetach = () => {
    if (!isEmpty) {
      setPendingAction({ type: 'detach' });
      return;
    }
    session.detach();
    handleClose();
  };

  // ── Confirm dialog resolution ──────────────────────────────
  const handleConfirmClear = () => {
    clearCart();
    if (pendingAction?.type === 'attach') {
      performAttach(pendingAction.payload, pendingAction.options);
    } else {
      session.detach();
      handleClose();
    }
    setPendingAction(null);
  };

  const handleKeepCart = () => {
    if (pendingAction?.type === 'attach') {
      performAttach(pendingAction.payload, pendingAction.options);
    } else {
      session.detach();
      handleClose();
    }
    setPendingAction(null);
  };

  const confirmTitle =
    pendingAction?.type === 'attach' ? 'Switch customer?' : 'Clear cart?';
  const confirmDescription =
    pendingAction?.type === 'attach'
      ? `The cart has ${items.length} item${items.length === 1 ? '' : 's'} from the current session. Clear the cart before switching to this customer?`
      : `The cart still has ${items.length} item${items.length === 1 ? '' : 's'}. Clear the cart as well?`;

  return (
    <>
      <BottomSheet
        isOpen={isOpen}
        onClose={handleClose}
        title="Customer"
      >
        <div className="flex flex-col gap-4">
          {/* Currently attached customer (session) */}
          {session.isAttached && !searchMobile && (
            <>
              <CustomerDisplayCard
                customer={{
                  customerId: session.customerId,
                  customerName: session.customerName,
                  customerMobile: session.customerMobile,
                }}
                onDetach={handleDetach}
                detachLabel="Remove"
              />
              <div className="flex items-center gap-2 text-sm text-stone-400">
                <div className="h-px flex-1 bg-stone-200" />
                <span>or switch customer</span>
                <div className="h-px flex-1 bg-stone-200" />
              </div>
            </>
          )}

          {/* Lookup input */}
          <CustomerLookupInput onSearch={handleSearch} isLoading={isLoading} />

          {/* Lookup result: found */}
          {searchMobile && customer && (
            <div className="flex flex-col gap-3">
              <CustomerDisplayCard customer={customer} />
              <Button type="button" onClick={handleAttachFound} className="h-11">
                Attach to Session
              </Button>
            </div>
          )}

          {/* Lookup result: not found -> create new */}
          {searchMobile && notFound && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-stone-500">{TOAST.CUSTOMER.NOT_FOUND}</p>
              <p className="text-sm font-semibold text-stone-700">Create New Customer</p>
              <NewCustomerForm
                defaultMobile={searchMobile}
                onCreated={handleNewCustomerCreated}
              />
            </div>
          )}
        </div>
      </BottomSheet>

      <ConfirmDialog
        isOpen={!!pendingAction}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel="Clear Cart"
        cancelLabel="Keep Cart"
        confirmVariant="destructive"
        onConfirm={handleConfirmClear}
        onCancel={handleKeepCart}
      />
    </>
  );
}