// src/hooks/orders/useOrders.js
// Paginated POS orders list — (pos)/orders page.
// Maps to: POST Services/POS/Order/List
//
// Reuses the confirmed normalizer from useCustomerOrders.js (Phase 10),
// which already maps the confirmed Order/List response shape:
//   transaction_id -> orderId (EntityId for Order/Retrieve)
//   document_no    -> orderNo
//   document_date  -> orderDate
//   party_name     -> customerName
//   gross_amount   -> totalAmount
//   status derived from balance_amount / receipt_amount
//     ('paid' | 'partial' | 'due')
//
// Server-side pagination via Take/Skip, same convention as
// useInvoiceList.js.

import { useQuery } from '@tanstack/react-query';
import { getOrders } from '@/services/orderService';
import { normalizeCustomerOrder } from '@/hooks/customer/useCustomerOrders';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {{ skip?: number }} [options]
 */
export function useOrders({ skip = 0 } = {}) {
  const take = APP_CONFIG.PAGINATION.ORDERS_TAKE;

  const query = useQuery({
    queryKey: QUERY_KEYS.ORDERS.LIST({ skip, take }),
    queryFn: async () => {
      const response = await getOrders({ take, skip });
      const entities = response?.Entities ?? response?.data ?? response?.result ?? [];
      return {
        orders: entities.map(normalizeCustomerOrder).filter(Boolean),
        totalCount: response?.TotalCount ?? entities.length,
      };
    },
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  return {
    orders:     query.data?.orders ?? [],
    totalCount: query.data?.totalCount ?? 0,
    take,
    isLoading:  query.isLoading,
    isFetching: query.isFetching,
    isError:    query.isError,
    refetch:    query.refetch,
  };
}