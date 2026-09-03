// What a given customer has actually purchased — i.e. what they can return.
// Feeds the Returns form's item picker; the selected rows go straight into
// calculateReturnItems() (see returnItemsService.js for why the raw row
// must be passed through unmodified).
//
// BUG FIX 2026-09-03: neither the request nor the query key was scoped by
// store — see getSoldItems()'s own header for the live confirmation that
// POS/InvoiceItems/List ignores company_id entirely, which is why the
// client-side filter lives in the service function itself, not here.

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getSoldItems } from '@/services/returnItemsService';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {number|null} partyId — attached customer
 */
export function useSoldItems(partyId) {
  const activeStoreId = useSelector(selectActiveStoreId);

  const query = useQuery({
    queryKey:  QUERY_KEYS.RETURNS.SOLD_ITEMS(partyId, activeStoreId),
    queryFn:   () => getSoldItems({ partyId, companyId: activeStoreId }),
    enabled:   !!partyId && !!activeStoreId,
    // A sale can happen at the counter moments before a return is raised,
    // so this shouldn't be cached as aggressively as static master data.
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  return {
    soldItems: query.data ?? [],
    isLoading: query.isLoading,
    isError:   query.isError,
    refetch:   query.refetch,
  };
}
