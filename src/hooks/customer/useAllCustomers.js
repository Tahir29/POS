// src/hooks/customer/useAllCustomers.js
// Background fetch of the full customer directory for the active store,
// used to power name search on /customers without relying on a
// confirmed server-side search endpoint.
//
// Fetches once with a large Take (covers TotalCount ~1400) and caches
// for STALE_TIME.STATIC (30 min) — subsequent searches filter this
// in-memory list client-side, no extra network calls.

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getCustomerList } from '@/services/customerService';
import { normalizeCustomer } from '@/lib/normalizers/customer';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {{ enabled?: boolean }} [options]
 */
export function useAllCustomers({ enabled = true } = {}) {
  const activeStoreId = useSelector(selectActiveStoreId);
  const take = APP_CONFIG.PAGINATION.CUSTOMERS_ALL_TAKE;

  const query = useQuery({
    queryKey: QUERY_KEYS.CUSTOMERS.ALL(activeStoreId),
    queryFn: async () => {
      const response = await getCustomerList({ take, skip: 0, companyId: activeStoreId });
      const entities = response?.data?.Entities ?? [];
      return entities.map(normalizeCustomer);
    },
    enabled: enabled && !!activeStoreId,
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
  });

  return {
    allCustomers: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
  };
}