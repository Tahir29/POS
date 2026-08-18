// src/hooks/customer/useCustomer360.js
// Customer 360 — full profile + purchase history + sales insights, for the
// customer detail page's 360 tab.
//
// Built 2026-08-12 after confirming three endpoints live against UAT with a
// real party_id (none of these were previously wired into this app):
//   - PARTY.RETRIEVE                     → { Entity: {...richer party record} }
//   - CUSTOMER_HISTORY.PARTY_TRANSACTIONS → { Invoices[], Orders[], Returns[],
//       Exchanges[], URDs[], BuyBacks[], Receipts[], invoice_total,
//       buyback_total, exchange_total, credit_balance }
//   - CUSTOMER_HISTORY.SALES_INSIGHTS     → { Entities: [{ kind, severity,
//       title, detail, priority }] } — generic, backend-computed; render
//       whatever comes back, never hardcode insight copy here.
//
// NOTE: PARTY_TRANSACTIONS is the endpoint useCustomerHistory.js's own header
// comment says doesn't exist ("credit_balance / exchange_total / buyback_total
// have no confirmed data source") — that was about the OLDER TRANSACTIONS
// endpoint. This is a different, newer endpoint that genuinely returns them.
// Left useCustomerHistory/the existing History tab untouched; this is an
// additive tab, not a replacement.

import { useQuery } from '@tanstack/react-query';
import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

export function useCustomer360(customerId, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: QUERY_KEYS.CUSTOMER_360.ALL(customerId),
    queryFn: async () => {
      const [partyRes, txRes, insightsRes] = await Promise.all([
        axiosInstance.post(API.PARTY.RETRIEVE, { EntityId: customerId }),
        axiosInstance.post(API.CUSTOMER_HISTORY.PARTY_TRANSACTIONS, { party_id: customerId }),
        axiosInstance.post(API.CUSTOMER_HISTORY.SALES_INSIGHTS, { party_id: customerId }),
      ]);

      const party = partyRes?.data?.Entity ?? null;
      const tx = txRes?.data ?? {};
      const insights = insightsRes?.data?.Entities ?? [];

      return {
        party,
        insights,
        documents: {
          invoice:  tx.Invoices  ?? [],
          order:    tx.Orders    ?? [],
          return:   tx.Returns   ?? [],
          exchange: tx.Exchanges ?? [],
          urd:      tx.URDs      ?? [],
          buyback:  tx.BuyBacks  ?? [],
          receipt:  tx.Receipts  ?? [],
        },
        totals: {
          invoiceTotal:  tx.invoice_total  ?? 0,
          buybackTotal:  tx.buyback_total  ?? 0,
          exchangeTotal: tx.exchange_total ?? 0,
          creditBalance: tx.credit_balance ?? 0,
        },
      };
    },
    enabled:   enabled && !!customerId,
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
