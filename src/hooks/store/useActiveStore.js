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
import { switchCompany } from '@/services/storeService';

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
   *
   * Also switches OrnaVerse's own SESSION company (storeService.switchCompany)
   * before touching local state — confirmed live 2026-09-15 that several
   * endpoints (Order/List, Invoice/List, the InterstoreReturn workflow)
   * scope themselves to the session's company, not to whatever `company_id`
   * an individual request sends. Every caller of this function goes through
   * one place, so no future call site can forget to keep the two in sync.
   * Awaited and allowed to throw — a caller that can't confirm the switch
   * on OrnaVerse's side should not proceed as if it succeeded.
   * @param {{ company_id, company_name, store_code }} store
   */
  const switchStore = useCallback(async (store) => {
    await switchCompany(store.company_id);
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