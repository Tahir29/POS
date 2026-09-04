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
import { fetchStoreScopedDocuments } from '@/services/crossStoreDocuments';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';
import { deriveDocumentStatus } from '@/hooks/customer/useCustomerOrders';

function isEmptyValue(v) {
  return v === null || v === undefined || v === 'NA' || v === '';
}

export function normalizeInvoice(entity) {
  if (!entity) return null;
  const get = (key) => (!isEmptyValue(entity[key]) ? entity[key] : null);

  const balanceAmount = get('balance_amount');
  const receiptAmount = get('receipt_amount');

  // BUG FIX 2026-09-03: this comment used to say "no status field on
  // InvoiceRow" — confirmed live that's wrong, document_status is present
  // on every row. See deriveDocumentStatus in useCustomerOrders.js.
  const status = deriveDocumentStatus(entity.document_status, balanceAmount, receiptAmount);

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
      // FIXED 2026-09-03: was calling getInvoiceList directly — confirmed
      // live that Invoice/List silently restricts some identities (e.g. the
      // multi-store "admin" account) to their own home company regardless
      // of company_id, returning zero rows for any other store. See
      // crossStoreDocuments.js for the full write-up. Its fallback path
      // pages the real, complete document index (not a capped recent-only
      // subset), so `take`/`skip` behave the same here whether or not the
      // fallback is active — page 2 genuinely returns the next page, not a
      // repeat of page 1. `viaFallback` is still surfaced in case a caller
      // wants to indicate "this store's data came via a slower path."
      const result   = await fetchStoreScopedDocuments({ kind: 'invoice', companyId: activeStoreId, take, skip });
      const entities = result.entities;
      return {
        invoices:   entities.map(normalizeInvoice).filter(Boolean),
        totalCount: result.totalCount,
        viaFallback: result.viaFallback,
      };
    },
    enabled:   isAuthenticated && !!activeStoreId,
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  return {
    invoices:    query.data?.invoices   ?? [],
    totalCount:  query.data?.totalCount ?? 0,
    viaFallback: query.data?.viaFallback ?? false,
    take,
    isLoading:  query.isLoading,
    isFetching: query.isFetching,
    isError:    query.isError,
    refetch:    query.refetch,
  };
}