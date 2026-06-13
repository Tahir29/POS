// src/hooks/invoices/useInvoiceList.js
// Paginated invoice directory — /invoices page.
// Maps to: POST Services/POS/Invoice/List
//
// NOTE: Field names (invoice_id, invoice_no, invoice_date, customer_name,
// total_amount) are per API_MAPPING.md's "expected fields" — UNCONFIRMED
// against a real response. normalizeInvoice() treats "NA"/missing as
// empty so the UI degrades gracefully if names differ; revisit once a
// real Postman response is shared (same pattern as Phase 9b promo/payment
// modes, which both needed field-name corrections after testing).

import { useQuery } from '@tanstack/react-query';
import { getInvoiceList } from '@/services/orderService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

function isEmptyValue(value) {
  return value === null || value === undefined || value === 'NA' || value === '';
}

/**
 * Normalizes an OrnaVerse invoice record for list display.
 */
export function normalizeInvoice(entity) {
  if (!entity) return null;
  const get = (key) => (!isEmptyValue(entity[key]) ? entity[key] : null);

  return {
    invoiceId:    get('invoice_id') ?? get('EntityId'),
    invoiceNo:    get('invoice_no') ?? get('invoice_id'),
    invoiceDate:  get('invoice_date') ?? get('creation_date'),
    customerName: get('customer_name') ?? get('party_name'),
    totalAmount:  get('total_amount') ?? get('total'),
    status:       get('status'),
    raw: entity,
  };
}

/**
 * @param {{ skip?: number }} [options]
 */
export function useInvoiceList({ skip = 0 } = {}) {
  const take = APP_CONFIG.PAGINATION.INVOICES_LIST_TAKE;

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