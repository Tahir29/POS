import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';

import { useActiveStore } from '@/hooks/store/useActiveStore';
import TOAST from '@/constants/toastMessages';

/**
 * useStoreSwitcher
 *
 * Handles mid-session store switching.
 * On switch:
 *   1. Updates active store in Redux via useActiveStore
 *   2. Invalidates all TanStack Query cache (store-scoped data must refetch)
 *   3. Shows a success toast with the new store name
 *   4. Redirects to /dashboard of the newly selected store
 *
 * Used by the Header store switcher component in Phase 3.
 */
export function useStoreSwitcher() {
  const { switchStore, activeStoreId } = useActiveStore();
  const queryClient = useQueryClient();
  const router = useRouter();

  const handleSwitchStore = useCallback(async (store) => {
    // Prevent switching to the already active store
    if (store.company_id === activeStoreId) {
      return;
    }

    // 1. Update Redux store context
    switchStore(store);

    // 2. Invalidate entire TanStack Query cache
    // All store-scoped queries (catalog, orders, inventory) must refetch
    await queryClient.invalidateQueries();

    // 3. Toast with store name
    const storeName = store.mailing_name ?? 'store';
    toast.success(TOAST.STORE.SWITCHED(storeName));

    // 4. Redirect to dashboard in new store context
    router.replace('/dashboard');
  }, [activeStoreId, switchStore, queryClient, router]);

  return { handleSwitchStore };
}