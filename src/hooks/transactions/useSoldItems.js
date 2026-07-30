// src/hooks/transactions/useSoldItems.js
// What a given customer has actually purchased — i.e. what they can return.
// Feeds the Returns form's item picker; the selected rows go straight into
// calculateReturnItems() (see returnItemsService.js for why the raw row
// must be passed through unmodified).

import { useQuery } from '@tanstack/react-query';
import { getSoldItems } from '@/services/returnItemsService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {number|null} partyId — attached customer
 */
export function useSoldItems(partyId) {
  const query = useQuery({
    queryKey:  QUERY_KEYS.RETURNS.SOLD_ITEMS(partyId),
    queryFn:   () => getSoldItems({ partyId }),
    enabled:   !!partyId,
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
