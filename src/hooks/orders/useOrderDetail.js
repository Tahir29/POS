// src/hooks/orders/useOrderDetail.js
// Single order detail — (pos)/orders/[orderId] page.
// Maps to: POST Services/POS/Order/Retrieve { EntityId: orderId }
//
// UNCONFIRMED RESPONSE SHAPE — written defensively.
// Assumption (pending real Postman response): Order/Retrieve returns a
// single record under `Entity`, in the same shape as one entry in
// Order/List's `Entities[]` array (transaction header + line_items[]).
// Falls back to `Entities?.[0]` / `data` / the raw response itself in
// case the wrapper differs.
//
// Reuses normalizeCustomerOrder for the header fields (orderId, orderNo,
// orderDate, customerName, totalAmount, status, etc.) and exposes
// lineItems separately for the line-items table.
//
// TODO: once a real Order/Retrieve response is shared, confirm:
//   - wrapper key (Entity vs Entities[0] vs raw)
//   - whether line_items[] is present at this level
//   - payment breakdown shape (receipt_details[] expected, per
//     Order/List, but unconfirmed for Retrieve)

import { useQuery } from '@tanstack/react-query';
import { getOrderDetail } from '@/services/orderService';
import { normalizeCustomerOrder } from '@/hooks/customer/useCustomerOrders';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

function extractOrderEntity(response) {
  if (!response) return null;
  if (response.Entity) return response.Entity;
  if (Array.isArray(response.Entities) && response.Entities.length > 0) {
    return response.Entities[0];
  }
  if (response.data) return response.data;
  if (response.result) return response.result;
  // Fallback: response itself may already be the order record
  if (response.transaction_id || response.document_no) return response;
  return null;
}

/**
 * @param {number|string|null} orderId - transaction_id from Order/List
 * @param {{ enabled?: boolean }} [options]
 */
export function useOrderDetail(orderId, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: QUERY_KEYS.ORDERS.DETAIL(orderId),
    queryFn: async () => {
      const response = await getOrderDetail(orderId);
      const entity = extractOrderEntity(response);
      const order = normalizeCustomerOrder(entity);
      return {
        order,
        lineItems: order?.lineItems ?? [],
        receiptDetails: Array.isArray(entity?.receipt_details) ? entity.receipt_details : [],
      };
    },
    enabled: enabled && orderId != null,
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  return {
    order:          query.data?.order ?? null,
    lineItems:      query.data?.lineItems ?? [],
    receiptDetails: query.data?.receiptDetails ?? [],
    isLoading:      query.isLoading,
    isFetching:     query.isFetching,
    isError:        query.isError,
    error:          query.error,
    refetch:        query.refetch,
  };
}