// src/hooks/store/useStoreSwitcher.js
// SEC-003: clearCart() is now dispatched on every store switch.
// Customer PII (customerId, customerName, customerMobile) was previously
// left in persisted cart state after a store switch. Clearing the cart
// ensures no customer data leaks across store contexts.

import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';

import { useActiveStore } from '@/hooks/store/useActiveStore';
import { clearCart } from '@/store/slices/cartSlice';
import TOAST from '@/constants/toastMessages';

/**
 * useStoreSwitcher
 *
 * Handles mid-session store switching.
 * On switch:
 *   1. Clears the cart (SEC-003 — removes customer PII from persisted state)
 *   2. Updates active store in Redux via useActiveStore
 *   3. Invalidates all TanStack Query cache (store-scoped data must refetch)
 *   4. Shows a success toast with the new store name
 *   5. Redirects to /dashboard of the newly selected store
 */
export function useStoreSwitcher() {
  const dispatch = useDispatch();
  const { switchStore, activeStoreId } = useActiveStore();
  const queryClient = useQueryClient();
  const router = useRouter();

  const handleSwitchStore = useCallback(async (store) => {
    // Prevent switching to the already active store
    if (store.company_id === activeStoreId) {
      return;
    }

    // 1. SEC-003: Clear cart to remove customer PII before switching context.
    //    Any in-progress sale is lost — this is intentional and matches the
    //    shared-device POS model where store switches are deliberate actions.
    dispatch(clearCart());

    // 2. Update Redux store context
    switchStore(store);

    // 3. Invalidate entire TanStack Query cache
    await queryClient.invalidateQueries();

    // 4. Toast with store name
    const storeName = store.mailing_name ?? 'store';
    toast.success(TOAST.STORE.SWITCHED(storeName));

    // 5. Redirect to dashboard in new store context
    router.replace('/dashboard');
  }, [activeStoreId, dispatch, switchStore, queryClient, router]);

  return { handleSwitchStore };
}