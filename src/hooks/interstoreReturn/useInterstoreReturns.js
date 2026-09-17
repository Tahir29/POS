// Interstore Return inbox/list — mirrors OrnaVerse's own IRR page toolbar:
// Inbox (returns raised against my store, awaiting MY approval), Submitted
// (returns I raised, awaiting absorption), All, plus a Pending-only toggle.
// See interstoreReturnService.js for the field/endpoint contract.

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { listInterstoreReturns } from '@/services/interstoreReturnService';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {{ mode?: 'inbox'|'outbox'|'all', pendingOnly?: boolean, skip?: number }} params
 */
export function useInterstoreReturns({ mode = 'inbox', pendingOnly = true, skip = 0 } = {}) {
  const companyId = useSelector(selectActiveStoreId);
  const take = APP_CONFIG.PAGINATION.ORDERS_TAKE ?? 50;

  const query = useQuery({
    queryKey: QUERY_KEYS.INTERSTORE_RETURN.LIST({ companyId, mode, pendingOnly, skip, take }),
    queryFn: () => listInterstoreReturns({ companyId, mode, pendingOnly, skip, take }),
    enabled: !!companyId,
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  return {
    rows: query.data?.rows ?? [],
    totalCount: query.data?.totalCount ?? 0,
    take,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
}
