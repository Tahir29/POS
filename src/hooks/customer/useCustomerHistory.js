// src/hooks/customer/useCustomerHistory.js
// Customer purchase history for the customer detail page's History tab.
//
// REBUILT 2026-07-16 — the original version assumed CustomerHistory/
// Transactions returned a combined PartyTransactionsResponse with
// Invoices[]/Orders[]/Returns[]/Exchanges[]/URDs[]/BuyBacks[] arrays plus
// invoice_total/buyback_total/exchange_total/credit_balance fields. None of
// that exists — confirmed via a real call that it's a plain
// { Entities[], TotalCount } list of invoice-header rows, nothing else.
// CustomerHistory/TotalReceipts is a separate, real endpoint that gives a
// payment-mode breakdown ({ mode, frequency, amount }[]).
//
// credit_balance / exchange_total / buyback_total have no confirmed data
// source — the obvious alternative (POSInvoice/GetCreditNote, GetExchange,
// GetOldGold) all return 500 exceptions on this UAT environment (confirmed
// 2026-07-16, same failure seen during checkout testing) — so these are
// omitted here rather than faked as 0.

import { useQuery } from '@tanstack/react-query';
import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

export function useCustomerHistory(customerId, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: QUERY_KEYS.CUSTOMER_HISTORY.TRANSACTIONS(customerId),
    queryFn: async () => {
      const [txRes, receiptsRes] = await Promise.all([
        axiosInstance.post(API.CUSTOMER_HISTORY.TRANSACTIONS,   { party_id: customerId }),
        axiosInstance.post(API.CUSTOMER_HISTORY.TOTAL_RECEIPTS, { party_id: customerId }),
      ]);
      const invoices     = txRes?.data?.Entities ?? [];
      const receiptModes = receiptsRes?.data?.Entities ?? [];
      const invoiceTotal = invoices.reduce((sum, inv) => sum + (Number(inv.net_amount) || 0), 0);
      return { invoices, receiptModes, invoiceTotal };
    },
    enabled:   enabled && !!customerId,
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  const data = query.data;

  return {
    invoices:     data?.invoices     ?? [],
    receiptModes: data?.receiptModes ?? [],
    invoiceTotal: data?.invoiceTotal ?? 0,

    isLoading:  query.isLoading,
    isFetching: query.isFetching,
    isError:    query.isError,
    refetch:    query.refetch,
  };
}
