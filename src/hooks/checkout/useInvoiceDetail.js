// src/hooks/checkout/useInvoiceDetail.js
// Fetch full invoice detail by transaction_id.
// Maps to: POST Services/POS/Invoice/Retrieve
//
// CONFIRMED response shape (v1.json): { Entity: InvoiceRow }
// Key display fields:
//   document_no  — invoice number
//   party_name   — customer name (NOT customer_name)
//   net_amount   — total amount (NOT total_amount)
//   document_date — invoice date
//   receipt_amount, balance_amount — payment status

import { useQuery } from '@tanstack/react-query';
import { getInvoiceDetail } from '@/services/orderService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

export function useInvoiceDetail(invoiceId) {
  const query = useQuery({
    // Moved from ORDERS.INVOICE_DETAIL to INVOICES.DETAIL
    queryKey: QUERY_KEYS.INVOICES.DETAIL(invoiceId),
    queryFn:  async () => {
      const data = await getInvoiceDetail(invoiceId);
      // Invoice/Retrieve wraps in Entity
      return data?.Entity ?? null;
    },
    enabled:   !!invoiceId,
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  return {
    invoice:   query.data ?? null,
    isLoading: query.isLoading,
    isError:   query.isError,
    refetch:   query.refetch,
  };
}