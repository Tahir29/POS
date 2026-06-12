// src/hooks/customer/useCustomerLookup.js
// Customer lookup by mobile number — Phase 9a (Customer Session).
// Returns the first matching customer (Entities[0]) or null if not found.

import { useQuery } from '@tanstack/react-query';
import { getCustomer } from '@/services/customerService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

/**
 * Normalizes an OrnaVerse customer record into the shape used by
 * cart.attachCustomer (customerId/customerName/customerMobile) plus
 * the full record for CustomerDisplayCard.
 */
function normalizeCustomer(entity) {
  if (!entity) return null;
  return {
    customerId:     entity.party_id,
    customerName:   entity.party_name,
    customerMobile: entity.mobile,
    raw:            entity,
  };
}

/**
 * @param {string} mobile - 10-digit mobile number
 * @param {{ enabled?: boolean }} [options]
 */
export function useCustomerLookup(mobile, options = {}) {
  const { enabled = true } = options;

  const query = useQuery({
    queryKey: QUERY_KEYS.CUSTOMERS.LOOKUP(mobile),
    queryFn: async () => {
      const response = await getCustomer(mobile);
      const entities = response?.data?.Entities ?? [];
      return entities.length > 0 ? normalizeCustomer(entities[0]) : null;
    },
    enabled: enabled && !!mobile,
    staleTime: APP_CONFIG.STALE_TIME.CUSTOMER,
    retry: false,
  });

  return {
    customer:   query.data ?? null,
    isLoading:  query.isFetching,
    isError:    query.isError,
    error:      query.error,
    notFound:   query.isFetched && !query.isError && query.data === null,
    refetch:    query.refetch,
  };
}