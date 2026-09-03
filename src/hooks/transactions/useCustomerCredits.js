// Outstanding credit a customer is owed — raised by Returns / Exchanges /
// Buy Backs, and settled by a Refund. Feeds the Refund form's picker.
//
// BUG FIX 2026-09-03: neither the request nor the query key was scoped by
// store — confirmed live that POSReceiptsSelect/List genuinely honours
// company_id (party 2221: 9 credits unscoped, 7 with company_id:1, 2 with
// company_id:4 — a real filter, not a no-op). Without it, a customer's
// credit from every store showed up regardless of which one was active,
// and switching stores wouldn't even refetch since activeStoreId wasn't
// part of the key.

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
