// Outstanding credit a customer is owed — raised by Returns / Exchanges /
// Buy Backs, and settled by a Refund. Feeds the Refund form's picker.

import { useQuery } from '@tanstack/react-query';
import { getCustomerCredits } from '@/services/refundService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {number|null} partyId — attached customer
 */
export function useCustomerCredits(partyId) {
  const query = useQuery({
    queryKey:  QUERY_KEYS.REFUNDS.CUSTOMER_CREDITS(partyId),
    queryFn:   () => getCustomerCredits({ partyId }),
    enabled:   !!partyId,
    // A return can be raised at the counter moments before the refund is
    // paid out, so this must not be cached hard.
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  return {
    credits:   query.data ?? [],
    isLoading: query.isLoading,
    isError:   query.isError,
    refetch:   query.refetch,
  };
}
