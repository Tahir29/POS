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
//
// BUG FIX 2026-09-03: neither call sent company_id, and the query key had
// no store dimension — the exact same bug useCustomer360.js already fixed
// once for the newer GetPartyTransactions/GetSalesInsights pair, just
// missed on these older endpoints still backing the live History tab.
// Confirmed live both genuinely honour it (party_id 2221): TRANSACTIONS
// returned company_id:1-only rows whether or not company_id was sent
// (server appears to default to the caller's own base company), and
// explicitly passing company_id:4 correctly returned zero; TOTAL_RECEIPTS
// returned completely different, correctly-scoped payment-mode breakdowns
// for company_id:1 vs company_id:4. No client-side backstop needed — both
// are genuinely filtered server-side.

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

export function useCustomerHistory(customerId, { enabled = true } = {}) {
  const activeStoreId = useSelector(selectActiveStoreId);

  const query = useQuery({
    queryKey: QUERY_KEYS.CUSTOMER_HISTORY.TRANSACTIONS(customerId, activeStoreId),
    queryFn: async () => {
      const [txRes, receiptsRes] = await Promise.all([
        axiosInstance.post(API.CUSTOMER_HISTORY.TRANSACTIONS,   { party_id: customerId, company_id: activeStoreId }),
        axiosInstance.post(API.CUSTOMER_HISTORY.TOTAL_RECEIPTS, { party_id: customerId, company_id: activeStoreId }),
      ]);
      const invoices     = txRes?.data?.Entities ?? [];
      const receiptModes = receiptsRes?.data?.Entities ?? [];
      const invoiceTotal = invoices.reduce((sum, inv) => sum + (Number(inv.net_amount) || 0), 0);
      return { invoices, receiptModes, invoiceTotal };
    },
    enabled:   enabled && !!customerId && !!activeStoreId,
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
