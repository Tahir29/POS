// src/hooks/customer/useCustomerOrders.js
// Customer order history — filtered by party_id from the full orders list.
//
// STATUS derived from balance_amount + receipt_amount (no status field in API):
//   balance_amount <= 0                         → "paid"
//   balance_amount > 0 && receipt_amount > 0    → "partial"
//   balance_amount > 0 && receipt_amount == 0   → "due"

import { useQuery } from '@tanstack/react-query';
import { getOrders } from '@/services/orderService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

function isEmptyValue(v) {
  return v === null || v === undefined || v === 'NA' || v === '';
}

export function normalizeCustomerOrder(entity) {
  if (!entity) return null;
  const get = (key) => (!isEmptyValue(entity[key]) ? entity[key] : null);

  const balanceAmount = get('balance_amount');
  const receiptAmount = get('receipt_amount');

  let status = APP_CONFIG.ORDER_STATUS.PAID;
  if (balanceAmount != null && balanceAmount > 0) {
    status = receiptAmount != null && receiptAmount > 0
      ? APP_CONFIG.ORDER_STATUS.PARTIAL
      : APP_CONFIG.ORDER_STATUS.DUE;
  }

  return {
    orderId:       get('transaction_id'),
    orderNo:       get('document_no'),
    orderDate:     get('document_date'),
    customerId:    get('party_id'),
    customerName:  get('party_name'),
    totalAmount:   get('net_amount'),
    balanceAmount,
    receiptAmount,
    status,
    companyName:   get('company_name'),
    lineItems:     Array.isArray(entity.line_items) ? entity.line_items : [],
    raw: entity,
  };
}

export function useCustomerOrders({ customerId, enabled = true } = {}) {
  const query = useQuery({
    queryKey: QUERY_KEYS.ORDERS.CUSTOMER_ORDERS(customerId ?? 'none'),
    queryFn:  async () => {
      // getOrders returns response.data (unwrapped by service)
      const data     = await getOrders({ take: 0 });
      const entities = data?.Entities ?? [];
      return entities.map(normalizeCustomerOrder).filter(Boolean);
    },
    enabled:   enabled && !!customerId,
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  // Client-side filter by customerId
  const allOrders = query.data ?? [];
  const orders = customerId
    ? allOrders.filter((o) => o.customerId != null && String(o.customerId) === String(customerId))
    : allOrders;

  return {
    orders,
    isLoading:  query.isLoading,
    isFetching: query.isFetching,
    isError:    query.isError,
    refetch:    query.refetch,
  };
}