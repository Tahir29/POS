// src/hooks/customer/useCustomerLookup.js
// Customer lookup by mobile number.
// Returns the first matching CustomerRow or null if not found.

import { useQuery } from '@tanstack/react-query';
import { getCustomer } from '@/services/customerService';
import { normalizeCustomer } from '@/lib/normalizers/customer';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

export function useCustomerLookup(mobile, options = {}) {
  const { enabled = true } = options;

  const query = useQuery({
    queryKey: QUERY_KEYS.CUSTOMERS.LOOKUP(mobile),
    queryFn:  async () => {
      // getCustomer returns AxiosResponse — unwrap .data here
      const response = await getCustomer(mobile);
      const entities = response?.data?.Entities ?? [];
      return entities.length > 0 ? normalizeCustomer(entities[0]) : null;
    },
    enabled:   enabled && !!mobile,
    staleTime: APP_CONFIG.STALE_TIME.CUSTOMER,
    retry:     false,
  });

  return {
    customer:  query.data    ?? null,
    isLoading: query.isFetching,
    isError:   query.isError,
    error:     query.error,
    notFound:  query.isFetched && !query.isError && query.data === null,
    refetch:   query.refetch,
  };
}