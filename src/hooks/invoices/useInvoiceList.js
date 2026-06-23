// src/hooks/invoices/useInvoiceList.js
// Paginated invoice directory — /invoices page.
// Maps to: POST Services/POS/Invoice/List
//
// CONFIRMED response shape (from a real Postman response): Entities[] of
// flat transaction-line-item records — one row per item sold, NOT one
// row per invoice/document. Key fields used here:
//   transaction_id   -> invoiceId (used as EntityId for Invoice/Retrieve)
//   document_no      -> invoiceNo
//   document_date    -> invoiceDate
//   party_name       -> customerName
//   email / mobile   -> customer contact
//   gross_amount     -> totalAmount (rounded final invoice total)
//   item_name        -> itemName
//   location_name / company_name -> store
//
// Since each row is one line item, the same document_no can repeat
// across consecutive rows (multiple items on one invoice). For the list
// UI we show one row per record as returned (matches the live OrnaVerse
// "Invoices" screen, which also lists one row per line item).

import { useQuery } from '@tanstack/react-query';
import { getInvoiceList } from '@/services/orderService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

function isEmptyValue(value) {
  return value === null || value === undefined || value === 'NA' || value === '';
}

/**
 * Normalizes an OrnaVerse invoice/transaction-item record for list display.
 */
export function normalizeInvoice(entity) {
  if (!entity) return null;
  const get = (key) => (!isEmptyValue(entity[key]) ? entity[key] : null);

  return {
    invoiceId:    get('transaction_id') ?? get('document_id'),
    invoiceNo:    get('document_no'),
    invoiceDate:  get('document_date'),
    customerName: get('party_name'),
    customerEmail: get('email'),
    customerMobile: get('mobile'),
    itemName:     get('item_name'),
    totalAmount:  get('gross_amount') ?? get('net_amount'),
    locationName: get('location_name') ?? get('company_name'),
    raw: entity,
  };
}

/**
 * @param {{ skip?: number }} [options]
 */
export function useInvoiceList({ skip = 0 } = {}) {
  const take = APP_CONFIG.PAGINATION.INVOICES_TAKE;

  const query = useQuery({
    queryKey: QUERY_KEYS.ORDERS.INVOICE_LIST({ skip, take }),
    queryFn: async () => {
      const response = await getInvoiceList({ take, skip });
      const entities = response?.Entities ?? [];
      return {
        invoices: entities.map(normalizeInvoice),
        totalCount: response?.TotalCount ?? entities.length,
      };
    },
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  return {
    invoices:   query.data?.invoices ?? [],
    totalCount: query.data?.totalCount ?? 0,
    take,
    isLoading:  query.isLoading,
    isFetching: query.isFetching,
    isError:    query.isError,
    refetch:    query.refetch,
  };
}