'use client';

// src/components/features/customer/CustomerSessionSheet/index.jsx
// BottomSheet-based sheet for the header Customer Session control.
// Flow: lookup by mobile (exact match) OR name (filters the customer
// directory, may return several) -> show found customer(s) (attach/detach)
// or "not found" -> NewCustomerForm.
//
// Trust/session-hygiene: if the cart already has items when attaching a
// different customer (or a guest cart when attaching anyone), or when
// detaching while items remain, the associate is prompted to clear the
// cart so items never silently carry over between customers.

import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { ChevronLeft, Loader2 } from 'lucide-react';
import BottomSheet from '@/components/shared/BottomSheet';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import CustomerLookupInput from '../CustomerLookupInput';
import CustomerDisplayCard from '../CustomerDisplayCard';
import CustomerListItem from '../CustomerListItem';
import NewCustomerForm from '../NewCustomerForm';
import { Button } from '@/components/ui/button';
import { useCustomerLookup } from '@/hooks/customer/useCustomerLookup';
import { useAllCustomers } from '@/hooks/customer/useAllCustomers';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';
import { useWalkInLookup } from '@/hooks/customer/useWalkInLookup';
import { useCart } from '@/hooks/cart/useCart';
import TOAST from '@/constants/toastMessages';

const MOBILE_REGEX = /^\d{10}$/;

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 * }} props
 */
export default function CustomerSessionSheet({ isOpen, onClose }) {
  const [searchQuery, setSearchQuery] = useState(null);
  const [nameResultSelection, setNameResultSelection] = useState(null); // chosen from a name-search list
  const [pendingAction, setPendingAction] = useState(null); // { type: 'attach' | 'detach', payload? }

  const session = useCustomerSession();
  const { items, isEmpty, clearCart } = useCart();

  const trimmed = (searchQuery ?? '').trim();
  const isMobileSearch = MOBILE_REGEX.test(trimmed);
  const isNameSearch   = !!searchQuery && !isMobileSearch;

  const { customer: mobileMatch, isLoading, isError, notFound } = useCustomerLookup(trimmed, {
    enabled: isMobileSearch,
  });

  // Store-entry check-in — fired once per mobile search from handleSearch
  // below (never auto-refetched, since every call also records a visit).
  // walkIn.result.customer, when present, is a CRM-level profile that may
  // or may not correspond to a registered billing customer (party) — see
  // normalizeWalkInCustomer for why the two must never be conflated.
  const walkIn = useWalkInLookup();
  const walkInKnown = walkIn.result?.found ? walkIn.result.customer : null;

  // Pre-warm the directory as soon as the sheet opens, so a name search
  // doesn't show a loading state the first time the staff types one.
  const { allCustomers, isFetching: isAllFetching } = useAllCustomers({ enabled: isOpen });

  const nameResults = isNameSearch
    ? allCustomers.filter((c) => c.customerName?.toLowerCase().includes(trimmed.toLowerCase()))
    : [];
  const isNameSearching = isNameSearch && isAllFetching && allCustomers.length === 0;

  // The customer currently under consideration for attach — either the
  // exact mobile match, or whichever name-search result was tapped.
  const customer = isMobileSearch ? mobileMatch : nameResultSelection;

  // Show a toast once per failed mobile lookup
  useEffect(() => {
    if (isError && isMobileSearch) {
      toast.error(TOAST.CUSTOMER.LOAD_FAILED);
    }
  }, [isError, isMobileSearch]);

  const handleSearch = (query) => {
    setNameResultSelection(null);
    setSearchQuery(query);
    walkIn.reset();
    const trimmedQuery = query.trim();
    if (MOBILE_REGEX.test(trimmedQuery)) {
      walkIn.lookup(trimmedQuery);
    }
  };

  // Reset search state whenever the sheet closes, so reopening starts fresh
  const handleClose = () => {
    setSearchQuery(null);
    setNameResultSelection(null);
    walkIn.reset();
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

  // A name-search result was tapped — record the walk-in visit right away
  // (mirrors handleSearch's mobile-search path), so the "Visit recorded"
  // note is visible before the staff commits to attaching.
  //
  // KNOWN LIMITATION (confirmed live 2026-07-21): Customer/List and
  // Customer/Retrieve both pre-mask mobile ("******9991") — the real digits
  // only ever exist in what staff type into the mobile-search box. So
  // selected.customerMobile here is masked, WALKIN.LOOKUP can never match
  // it, and this will silently no-op (WalkInRecorded stays false, "Visit
  // recorded" never shows) for every name-search attach. Left in place
  // intentionally per product decision — not a bug to "fix" without a
  // read/unmasked-mobile API change from OrnaVerse.
  const handleSelectNameResult = (selected) => {
    setNameResultSelection(selected);
    walkIn.reset();
    if (selected?.customerMobile) {
      walkIn.lookup(selected.customerMobile);
    }
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
          {session.isAttached && !searchQuery && (
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
          <CustomerLookupInput onSearch={handleSearch} isLoading={isLoading || isNameSearching} />

          {/* Mobile search: found */}
          {isMobileSearch && customer && (
            <div className="flex flex-col gap-3">
              {walkInKnown && (
                <p className="text-xs text-stone-400">
                  Visit recorded{walkInKnown.name ? ` — welcome back, ${walkInKnown.name}` : ' — welcome back'}.
                </p>
              )}
              <CustomerDisplayCard customer={customer} />
              <Button type="button" onClick={handleAttachFound} className="h-11">
                Attach to Session
              </Button>
            </div>
          )}

          {/* Mobile search: not found as a billing customer — still checking
              whether they're a known walk-in before deciding what to show */}
          {isMobileSearch && notFound && walkIn.isLoading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-stone-500">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Checking visit history…
            </div>
          )}

          {/* Mobile search: not found, and a known walk-in (visited before,
              never registered as a billing customer) -> signup, name pre-filled */}
          {isMobileSearch && notFound && !walkIn.isLoading && walkInKnown && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-stone-500">
                {walkInKnown.name ? `Welcome back, ${walkInKnown.name}.` : 'Welcome back.'} They've visited before but aren't a registered customer yet.
              </p>
              <p className="text-sm font-semibold text-stone-700">Complete Customer Signup</p>
              <NewCustomerForm
                defaultMobile={trimmed}
                defaultName={walkInKnown.name ?? ''}
                onCreated={handleNewCustomerCreated}
              />
            </div>
          )}

          {/* Mobile search: not found anywhere -> create new */}
          {isMobileSearch && notFound && !walkIn.isLoading && !walkInKnown && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-stone-500">{TOAST.CUSTOMER.NOT_FOUND}</p>
              <p className="text-sm font-semibold text-stone-700">Create New Customer</p>
              <NewCustomerForm
                defaultMobile={trimmed}
                onCreated={handleNewCustomerCreated}
              />
            </div>
          )}

          {/* Name search: loading directory */}
          {isNameSearch && isNameSearching && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-stone-500">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Searching customers…
            </div>
          )}

          {/* Name search: a result was tapped -> confirm + attach */}
          {isNameSearch && !isNameSearching && nameResultSelection && (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => { setNameResultSelection(null); walkIn.reset(); }}
                className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 w-fit"
              >
                <ChevronLeft size={15} aria-hidden="true" />
                Back to results
              </button>
              {walkIn.isLoading && (
                <p className="text-xs text-stone-400 flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                  Recording visit…
                </p>
              )}
              {walkInKnown && (
                <p className="text-xs text-stone-400">
                  Visit recorded{walkInKnown.name ? ` — welcome back, ${walkInKnown.name}` : ' — welcome back'}.
                </p>
              )}
              <CustomerDisplayCard customer={customer} />
              <Button type="button" onClick={handleAttachFound} className="h-11">
                Attach to Session
              </Button>
            </div>
          )}

          {/* Name search: multiple candidates -> pick one */}
          {isNameSearch && !isNameSearching && !nameResultSelection && nameResults.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-stone-400">{nameResults.length} match{nameResults.length === 1 ? '' : 'es'}</p>
              {nameResults.map((c) => (
                <CustomerListItem
                  key={c.customerId}
                  customer={c}
                  onSelect={() => handleSelectNameResult(c)}
                />
              ))}
            </div>
          )}

          {/* Name search: no matches -> create new */}
          {isNameSearch && !isNameSearching && !nameResultSelection && nameResults.length === 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-stone-500">No matching customers found.</p>
              <p className="text-sm font-semibold text-stone-700">Create New Customer</p>
              <NewCustomerForm onCreated={handleNewCustomerCreated} />
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