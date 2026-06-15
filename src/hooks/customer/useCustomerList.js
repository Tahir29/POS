// src/hooks/customer/useCustomerList.js
// Paginated customer directory for the active store — /customers page.
// Maps to: POST Services/POS/Customer/List
// Confirmed response shape: { Entities[], TotalCount, Skip, Take }

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getCustomerList } from '@/services/customerService';
import { normalizeCustomer } from '@/lib/normalizers/customer';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {{ skip?: number }} [options]
 */
export function useCustomerList({ skip = 0 } = {}) {
  const activeStoreId = useSelector(selectActiveStoreId);
  const take = APP_CONFIG.PAGINATION.CUSTOMERS_TAKE;

  const query = useQuery({
    queryKey: QUERY_KEYS.CUSTOMERS.LIST({ companyId: activeStoreId, skip, take }),
    queryFn: async () => {
      const response = await getCustomerList({ take, skip, companyId: activeStoreId });
      const entities = response?.data?.Entities ?? [];
      return {
        customers: entities.map(normalizeCustomer),
        totalCount: response?.data?.TotalCount ?? 0,
      };
    },
    enabled: !!activeStoreId,
    staleTime: APP_CONFIG.STALE_TIME.CUSTOMER,
  });

  return {
    customers:  query.data?.customers ?? [],
    totalCount: query.data?.totalCount ?? 0,
    take,
    isLoading:  query.isLoading,
    isFetching: query.isFetching,
    isError:    query.isError,
    refetch:    query.refetch,
  };
}