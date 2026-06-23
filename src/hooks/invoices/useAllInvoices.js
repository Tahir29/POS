// src/hooks/invoices/useAllInvoices.js
// Full-dataset invoice fetch for client-side search/filter.
// Mirrors useAllOrders — fetched once with Take:0, cached.
// Used by /invoices page when any filter is active.

import { useQuery } from '@tanstack/react-query';
import { getInvoiceList } from '@/services/orderService';
import { normalizeInvoice } from '@/hooks/invoices/useInvoiceList';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

export function useAllInvoices() {
  const query = useQuery({
    queryKey: QUERY_KEYS.ORDERS.INVOICE_LIST({ skip: 0, take: 0 }),
    queryFn: async () => {
      const response = await getInvoiceList({ take: 0, skip: 0 });
      const entities = response?.Entities ?? [];
      return entities.map(normalizeInvoice);
    },
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  return {
    allInvoices: query.data ?? [],
    isLoading:   query.isLoading,
    isFetching:  query.isFetching,
    isError:     query.isError,
  };
}