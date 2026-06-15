// src/hooks/checkout/useInvoiceDetail.js
// Fetch invoice detail — Phase 9b (Checkout) + /invoices.
// Maps to: POST Services/POS/Invoice/Retrieve
//
// Response shape: a real Invoice/List response returned flat
// transaction records (not wrapped in Entity) — see useInvoiceList.js.
// Invoice/Retrieve's wrapping is unconfirmed, so this reads data?.Entity
// first and falls back to data itself if it looks like a flat invoice
// record (has transaction_id).

import { useQuery } from '@tanstack/react-query';
import { getInvoiceDetail } from '@/services/orderService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {number|null} invoiceId
 */
export function useInvoiceDetail(invoiceId) {
  const query = useQuery({
    queryKey: QUERY_KEYS.ORDERS.INVOICE_DETAIL(invoiceId),
    queryFn: async () => {
      const data = await getInvoiceDetail(invoiceId);
      if (data?.Entity) return data.Entity;
      if (data?.transaction_id) return data; // flat response fallback
      return null;
    },
    enabled: !!invoiceId,
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  return {
    invoice: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}