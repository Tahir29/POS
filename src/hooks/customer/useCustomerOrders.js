// src/hooks/customer/useCustomerOrders.js
// Customer order history — Phase 10 Customer Detail page.
// Maps to: POST Services/POS/Order/List (Take: 0 = all records)
//
// Order/List response shape is UNCONFIRMED (see DEVELOPMENT_PHASES.md /
// API_MAPPING.md). Following the same Entities[]/TotalCount convention as
// Invoice/List (see useInvoiceList.js), but field names for the customer
// link and order identifiers are best-effort with fallbacks:
//   customerId   <- party_id ?? customer_id ?? party_code
//   orderNo      <- document_no ?? order_no ?? transaction_id
//   orderDate    <- document_date ?? order_date ?? created_date
//   totalAmount  <- gross_amount ?? net_amount ?? total_amount
//   status       <- order_status ?? status
//
// Client-side filtered by the viewed customer's party_id (or matching
// mobile as a fallback, in case party_id isn't present on order records).

import { useQuery } from '@tanstack/react-query';
import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

function isEmptyValue(value) {
  return value === null || value === undefined || value === 'NA' || value === '';
}

/**
 * Normalizes an OrnaVerse order record for display in customer history.
 */
export function normalizeCustomerOrder(entity) {
  if (!entity) return null;
  const get = (key) => (!isEmptyValue(entity[key]) ? entity[key] : null);

  const grossAmount = get('gross_amount') ?? get('net_amount') ?? get('total_amount');
  const balanceAmount = get('balance_amount');
  const receiptAmount = get('receipt_amount');

  // Order/List has no status field. Derive a display status from balance:
  // balance_amount <= 0 (or null)  -> Paid
  // balance_amount > 0 and receipt > 0 -> Partial
  // balance_amount > 0 and receipt == 0/null -> Due
  let status = 'paid';
  if (balanceAmount != null && balanceAmount > 0) {
    status = receiptAmount != null && receiptAmount > 0 ? 'partial' : 'due';
  }

  return {
    orderId:        get('transaction_id') ?? get('order_id') ?? get('document_id'),
    orderNo:        get('document_no') ?? get('order_no'),
    orderDate:      get('document_date') ?? get('order_date') ?? get('created_date'),
    customerId:     get('party_id') ?? get('customer_id'),
    customerName:   get('party_name'),
    customerMobile: get('mobile'),
    totalAmount:    grossAmount,
    balanceAmount,
    receiptAmount,
    status,
    companyName:    get('company_name'),
    lineItems:      Array.isArray(entity.line_items) ? entity.line_items : [],
    raw: entity,
  };
}

/**
 * Fetches all POS orders and filters them down to those belonging to the
 * given customer (matched by party_id, falling back to mobile number).
 *
 * @param {{ customerId?: number|string|null, customerMobile?: string|null, enabled?: boolean }} params
 */
export function useCustomerOrders({ customerId, customerMobile, enabled = true } = {}) {
  const query = useQuery({
    queryKey: QUERY_KEYS.ORDERS.CUSTOMER_ORDERS(customerId ?? customerMobile ?? 'none'),
    queryFn: async () => {
      const response = await axiosInstance.post(API.ORDERS.LIST, { Take: 0 });
      const data = response?.data;
      const entities = data?.Entities ?? data?.data ?? data?.result ?? [];
      return entities.map(normalizeCustomerOrder).filter(Boolean);
    },
    enabled: enabled && (!!customerId || !!customerMobile),
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  const allOrders = query.data ?? [];
  const orders = allOrders.filter((order) => {
    if (customerId != null && order.customerId != null) {
      return String(order.customerId) === String(customerId);
    }
    if (customerMobile && order.customerMobile) {
      return order.customerMobile === customerMobile;
    }
    return false;
  });

  return {
    orders,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
}