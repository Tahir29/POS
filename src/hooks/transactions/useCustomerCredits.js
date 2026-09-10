// Outstanding credit a customer is owed — raised by Returns / Exchanges /
// Buy Backs, and settled by a Refund. Feeds the Refund form's picker.
// Scoped by store: POSReceiptsSelect/List genuinely filters by company_id,
// so both the request and the query key must include activeStoreId.

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getCustomerCredits } from '@/services/refundService';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {number|null} partyId — attached customer
 */
export function useCustomerCredits(partyId) {
  const activeStoreId = useSelector(selectActiveStoreId);

  const query = useQuery({
    queryKey:  QUERY_KEYS.REFUNDS.CUSTOMER_CREDITS(partyId, activeStoreId),
    queryFn:   () => getCustomerCredits({ partyId, companyId: activeStoreId }),
    enabled:   !!partyId && !!activeStoreId,
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  return {
    credits:   query.data ?? [],
    isLoading: query.isLoading,
    isError:   query.isError,
    refetch:   query.refetch,
  };
}
