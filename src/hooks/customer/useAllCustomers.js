// src/hooks/customer/useAllCustomers.js
// Full customer directory for the active store — used for client-side name search.
// Fetches once with a large Take, caches for STALE_TIME.STATIC (30 min).

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getCustomerList } from '@/services/customerService';
import { normalizeCustomer } from '@/lib/normalizers/customer';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

export function useAllCustomers({ enabled = true } = {}) {
  const activeStoreId   = useSelector(selectActiveStoreId);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const take = APP_CONFIG.PAGINATION.CUSTOMERS_ALL_TAKE;

  const query = useQuery({
    queryKey: QUERY_KEYS.CUSTOMERS.ALL(activeStoreId),
    queryFn:  async () => {
      // getCustomerList returns response.data (unwrapped by service)
      const data     = await getCustomerList({ take, skip: 0, companyId: activeStoreId });
      const entities = data?.Entities ?? [];
      return entities.map(normalizeCustomer).filter(Boolean);
    },
    enabled:   enabled && isAuthenticated && !!activeStoreId,
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
  });

  return {
    allCustomers: query.data ?? [],
    isLoading:    query.isLoading,
    isFetching:   query.isFetching,
    isError:      query.isError,
  };
}