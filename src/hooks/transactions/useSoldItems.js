// What a given customer has actually purchased — i.e. what they can return.
// Feeds the Returns form's item picker; the selected rows go straight into
// calculateReturnItems() (see returnItemsService.js for why the raw row
// must be passed through unmodified). Store scoping is done client-side
// inside getSoldItems() itself, since POS/InvoiceItems/List ignores
// company_id server-side — see that function's header.

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
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  return {
    soldItems: query.data ?? [],
    isLoading: query.isLoading,
    isError:   query.isError,
    refetch:   query.refetch,
  };
}
