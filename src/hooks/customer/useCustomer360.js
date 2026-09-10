// src/hooks/customer/useCustomer360.js
// Customer 360 — full profile + purchase history + sales insights, for the
// customer detail page's 360 tab. Combines PARTY.RETRIEVE, PARTY_TRANSACTIONS,
// and SALES_INSIGHTS; additive to (not a replacement for) the existing History
// tab / useCustomerHistory.js.

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

export function useCustomer360(customerId, { enabled = true } = {}) {
  // company_id must be sent on both calls to scope results to the active
  // store — otherwise this tab shows history/insights across every store.
  const activeStoreId = useSelector(selectActiveStoreId);

  const query = useQuery({
    queryKey: QUERY_KEYS.CUSTOMER_360.ALL(customerId, activeStoreId),
    queryFn: async () => {
      const [partyRes, txRes, insightsRes] = await Promise.all([
        axiosInstance.post(API.PARTY.RETRIEVE, { EntityId: customerId }),
        axiosInstance.post(API.CUSTOMER_HISTORY.PARTY_TRANSACTIONS, { party_id: customerId, company_id: activeStoreId }),
        axiosInstance.post(API.CUSTOMER_HISTORY.SALES_INSIGHTS, { party_id: customerId, company_id: activeStoreId }),
      ]);

      const party = partyRes?.data?.Entity ?? null;
      const tx = txRes?.data ?? {};
      const insights = insightsRes?.data?.Entities ?? [];

      // Client-side backstop: GetPartyTransactions' Orders[] sub-array comes
      // back unfiltered by company_id even when the param is sent (same gap
      // as the standalone POS/Order/List — see useAllOrders.js). Scoping
      // every sub-array here is a no-op for the ones that already filter
      // correctly server-side, so it's cheap insurance either way.
      const scoped = (rows) => (rows ?? []).filter((r) => r.company_id === activeStoreId);

      return {
        party,
        insights,
        documents: {
          invoice:  scoped(tx.Invoices),
          order:    scoped(tx.Orders),
          return:   scoped(tx.Returns),
          exchange: scoped(tx.Exchanges),
          urd:      scoped(tx.URDs),
          buyback:  scoped(tx.BuyBacks),
          receipt:  scoped(tx.Receipts),
        },
        totals: {
          invoiceTotal:  tx.invoice_total  ?? 0,
          buybackTotal:  tx.buyback_total  ?? 0,
          exchangeTotal: tx.exchange_total ?? 0,
          creditBalance: tx.credit_balance ?? 0,
        },
      };
    },
    enabled:   enabled && !!customerId && !!activeStoreId,
    staleTime: APP_CONFIG.STALE_TIME.CUSTOMER,
  });

  const data = query.data;

  return {
    party:        data?.party ?? null,
    insights:     data?.insights ?? [],
    documents:    data?.documents ?? {
      invoice: [], order: [], return: [], exchange: [], urd: [], buyback: [], receipt: [],
    },
    totals: data?.totals ?? {
      invoiceTotal: 0, buybackTotal: 0, exchangeTotal: 0, creditBalance: 0,
    },

    isLoading:  query.isLoading,
    isFetching: query.isFetching,
    isError:    query.isError,
    refetch:    query.refetch,
  };
}
