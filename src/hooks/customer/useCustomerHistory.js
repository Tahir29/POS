// src/hooks/customer/useCustomerHistory.js
// Customer transaction history — all invoices, orders, returns, exchanges.
//
// CustomerHistory/Transactions returns PartyTransactionsResponse:
//   Invoices[], Orders[], Returns[], Exchanges[], URDs[], BuyBacks[]
//   Receipts[], invoice_total, buyback_total, exchange_total, credit_balance

import { useQuery } from '@tanstack/react-query';
import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

export function useCustomerHistory(customerId, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: QUERY_KEYS.CUSTOMER_HISTORY.TRANSACTIONS(customerId),
    queryFn:  async () => {
      const response = await axiosInstance.post(API.CUSTOMER_HISTORY.TRANSACTIONS, {
        party_id: customerId,
      });
      return response?.data ?? null;
    },
    enabled:   enabled && !!customerId,
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  const data = query.data;

  return {
    // Top-level transaction arrays
    invoices:  data?.Invoices  ?? [],
    orders:    data?.Orders    ?? [],
    returns:   data?.Returns   ?? [],
    exchanges: data?.Exchanges ?? [],
    urds:      data?.URDs      ?? [],
    buybacks:  data?.BuyBacks  ?? [],
    receipts:  data?.Receipts  ?? [],

    // Summary totals
    invoiceTotal:  data?.invoice_total  ?? 0,
    buybackTotal:  data?.buyback_total  ?? 0,
    exchangeTotal: data?.exchange_total ?? 0,
    creditBalance: data?.credit_balance ?? 0,

    isLoading:  query.isLoading,
    isFetching: query.isFetching,
    isError:    query.isError,
    refetch:    query.refetch,
  };
}