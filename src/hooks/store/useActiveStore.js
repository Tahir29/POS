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
   * TanStack Query cache invalidation for store-scoped queries
   * is handled by the component initiating the switch.
   * @param {{ company_id, company_name, store_code }} store
   */
  const switchStore = useCallback((store) => {
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