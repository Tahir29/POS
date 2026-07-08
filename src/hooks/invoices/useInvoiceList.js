// src/hooks/invoices/useInvoiceList.js
// Paginated invoice list — /invoices page.
// Maps to: POST Services/POS/Invoice/List
//
// CONFIRMED InvoiceRow field names (v1.json):
//   transaction_id  — primary key
//   document_no     — invoice number
//   document_date   — date
//   party_name      — customer name
//   net_amount      — total amount
//   receipt_amount  — amount paid
//   balance_amount  — amount outstanding
//   mobile, email   — customer contact
//   company_name    — store name

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getInvoiceList } from '@/services/orderService';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

function isEmptyValue(v) {
  return v === null || v === undefined || v === 'NA' || v === '';
}

export function normalizeInvoice(entity) {
  if (!entity) return null;
  const get = (key) => (!isEmptyValue(entity[key]) ? entity[key] : null);

  const balanceAmount = get('balance_amount');
  const receiptAmount = get('receipt_amount');

  // Derive status — no status field on InvoiceRow
  let status = APP_CONFIG.ORDER_STATUS.PAID;
  if (balanceAmount != null && balanceAmount > 0) {
    status = receiptAmount != null && receiptAmount > 0
      ? APP_CONFIG.ORDER_STATUS.PARTIAL
      : APP_CONFIG.ORDER_STATUS.DUE;
  }

  return {
    invoiceId:      get('transaction_id'),
    invoiceNo:      get('document_no'),
    invoiceDate:    get('document_date'),
    customerName:   get('party_name'),
    customerMobile: get('mobile'),
    customerEmail:  get('email'),
    totalAmount:    get('net_amount'),
    balanceAmount,
    receiptAmount,
    status,
    storeName:      get('company_name'),
    raw: entity,
  };
}

export function useInvoiceList({ skip = 0 } = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const activeStoreId   = useSelector(selectActiveStoreId);
  const take = APP_CONFIG.PAGINATION.INVOICES_TAKE;

  const query = useQuery({
    // Fixed: was QUERY_KEYS.ORDERS.INVOICE_LIST — moved to INVOICES.LIST
    queryKey: QUERY_KEYS.INVOICES.LIST({ skip, take, companyId: activeStoreId }),
    queryFn: async () => {
      // getInvoiceList returns response.data (service unwraps)
      const data     = await getInvoiceList({ take, skip, company_id: activeStoreId });
      const entities = data?.Entities ?? [];
      return {
        invoices:   entities.map(normalizeInvoice).filter(Boolean),
        totalCount: data?.TotalCount ?? entities.length,
      };
    },
    enabled:   isAuthenticated && !!activeStoreId,
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  return {
    invoices:   query.data?.invoices   ?? [],
    totalCount: query.data?.totalCount ?? 0,
    take,
    isLoading:  query.isLoading,
    isFetching: query.isFetching,
    isError:    query.isError,
    refetch:    query.refetch,
  };
}