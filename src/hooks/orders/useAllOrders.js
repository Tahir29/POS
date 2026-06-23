// src/hooks/orders/useAllOrders.js
// Background fetch of ALL POS orders for in-memory search and date
// filtering on the /orders page.
//
// Mirrors the useAllCustomers pattern exactly:
//   - Fetches once with Take: 0 (all records) and caches for
//     STALE_TIME.ORDERS.
//   - Client-side filtering (order number, customer name, date range)
//     runs against this in-memory list — no extra network calls per
//     keystroke.
//   - Pagination is hidden while any filter is active (the filtered
//     result set IS the full result; page count is meaningless).
//
// Reuses normalizeCustomerOrder from useCustomerOrders.js (confirmed
// against real Order/List response shape).

import { useQuery } from '@tanstack/react-query';
import { getOrders } from '@/services/orderService';
import { normalizeCustomerOrder } from '@/hooks/customer/useCustomerOrders';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {{ enabled?: boolean }} [options]
 */
export function useAllOrders({ enabled = true } = {}) {
  const query = useQuery({
    queryKey: QUERY_KEYS.ORDERS.LIST({ skip: 0, take: 0 }),
    queryFn: async () => {
      const response = await getOrders({ take: 0, skip: 0 });
      const entities = response?.Entities ?? response?.data ?? response?.result ?? [];
      return entities.map(normalizeCustomerOrder).filter(Boolean);
    },
    enabled,
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  return {
    allOrders:  query.data ?? [],
    isLoading:  query.isLoading,
    isFetching: query.isFetching,
    isError:    query.isError,
  };
}