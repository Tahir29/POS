// src/hooks/checkout/useOrderDetail.js
// Fetch full POS order detail by transaction_id.
// Maps to: POST Services/POS/Order/Retrieve
//
// The Order counterpart of useInvoiceDetail. OrderRow and InvoiceRow share
// their field names (confirmed v1.json — see orderService.js), so the
// confirmation screen can read either through one shape:
//   document_no    — order number
//   party_name     — customer name (NOT customer_name)
//   net_amount     — total amount (NOT total_amount)
//   document_date  — order date
//   receipt_amount — advance taken
//   balance_amount — outstanding on collection (expected > 0 on an order)

import { useQuery } from '@tanstack/react-query';
import { getOrderDetail } from '@/services/orderService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

export function useOrderDetail(orderId) {
  const query = useQuery({
    queryKey: QUERY_KEYS.ORDERS.DETAIL(orderId),
    queryFn:  async () => {
      const data = await getOrderDetail(orderId);
      // Order/Retrieve wraps in Entity, same as Invoice/Retrieve.
      return data?.Entity ?? null;
    },
    enabled:   !!orderId,
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  return {
    order:     query.data ?? null,
    isLoading: query.isLoading,
    isError:   query.isError,
    refetch:   query.refetch,
  };
}
