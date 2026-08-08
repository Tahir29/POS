import { useDispatch, useSelector } from 'react-redux';
import { useCallback } from 'react';

import {
  setActiveStore,
  clearStore,
  selectActiveStoreId,
  selectActiveStoreName,
  selectActiveStoreCode,
  selectAvailableStores,
} from '@/store/slices/storeSlice';
import queryClient from '@/lib/queryClient';

/**
 * useActiveStore — provides active store context and store switching action.
 *
 * Provides:
 *   - activeStoreId: number | null
 *   - activeStoreName: string | null
 *   - activeStoreCode: string | null
 *   - availableStores: Store[]
 *   - switchStore(store): sets a new active store in Redux
 *   - clearActiveStore(): clears store context
 */
export function useActiveStore() {
  const dispatch = useDispatch();

  const activeStoreId = useSelector(selectActiveStoreId);
  const activeStoreName = useSelector(selectActiveStoreName);
  const activeStoreCode = useSelector(selectActiveStoreCode);
  const availableStores = useSelector(selectAvailableStores);

  /**
   * Switches the active store context.
   *
   * Clears the TanStack Query cache here rather than leaving it to the
   * caller — the previous contract ("handled by the component initiating
   * the switch") was never actually honored by StoreSelectionGrid, the only
   * real caller, so every store-scoped query not keyed by store id (schemes
   * list, payment modes, sales persons, financial year/document config, ...)
   * kept serving the PREVIOUS store's cached data after a switch. Doing it
   * here means it can't be forgotten by a future caller either.
   * @param {{ company_id, company_name, store_code }} store
   */
  const switchStore = useCallback((store) => {
    queryClient.clear();
    dispatch(
      setActiveStore({
        storeId: store.company_id,
        storeName: store.mailing_name,
        storeCode: store.company_code ?? null,
      })
    );
  }, [dispatch]);

  const clearActiveStore = useCallback(() => {
    dispatch(clearStore());
  }, [dispatch]);

  return {
    activeStoreId,
    activeStoreName,
    activeStoreCode,
    availableStores,
    switchStore,
    clearActiveStore,
  };
}