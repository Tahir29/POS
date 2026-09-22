// src/hooks/customer/useCustomer360.js
// Customer 360 — full profile + purchase history + sales insights, for the
// customer detail page's 360 tab. Combines PARTY.RETRIEVE, PARTY_TRANSACTIONS,
// and SALES_INSIGHTS; additive to (not a replacement for) the existing History
// tab / useCustomerHistory.js.

import { useQuery } from '@tanstack/react-query';
import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

export function useCustomer360(customerId, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: QUERY_KEYS.CUSTOMER_360.ALL(customerId),
    queryFn: async () => {
      // CONFIRMED LIVE 2026-09-22 against OrnaVerse's own UAT client: its
      // "Customer History" popup is cross-store, not scoped to the active
      // session company — sending company_id here silently dropped 2 of 4
      // real invoices for the test customer. Omit it on both calls, same
      // as checkout's own getPartyReceipts() already does.
      const [partyRes, txRes, insightsRes] = await Promise.all([
        axiosInstance.post(API.PARTY.RETRIEVE, { EntityId: customerId }),
        axiosInstance.post(API.CUSTOMER_HISTORY.PARTY_TRANSACTIONS, { party_id: customerId }),
        axiosInstance.post(API.CUSTOMER_HISTORY.SALES_INSIGHTS, { party_id: customerId }),
      ]);

      const party = partyRes?.data?.Entity ?? null;
      const tx = txRes?.data ?? {};
      const insights = insightsRes?.data?.Entities ?? [];
      // CONFIRMED LIVE 2026-09-22 against OrnaVerse's own UAT client: its
      // "Customer History" > Credit Balance tile matches THIS field exactly
      // (company-scoped, Exchange-type only) — NOT checkout's combined
      // scheme+exchange+credit-note figure (POSReceiptsSelect/List). They
      // are two different, both-correct concepts: this tile is a strict
      // subset (Exchange credit only), checkout's is every applicable
      // payment-credit bucket. Do not "reconcile" them again — see
      // checkout-credit-balance-open-question memory.
      const creditBalance = tx.credit_balance ?? 0;
      const exchangeTotal = tx.exchange_total ?? 0;
      const buybackTotal = tx.buyback_total ?? 0;
      // CONFIRMED LIVE 2026-09-22 (two independent real customers): OrnaVerse's
      // own "Total Earnings" nets out BOTH exchange (trade-in) and buyback
      // payout value from invoice_total — neither is new revenue, both are
      // credit/cash given back to the customer. First customer had
      // buyback_total 0 (131839 = 143838 - 11999 checked out). Second, with
      // real buyback activity, only matched once buyback was subtracted too:
      // invoice_total 1391774 - exchange_total 300954 - buyback_total 136460
      // = 954360, exact match to OrnaVerse's displayed figure. It does NOT
      // net out fully-returned invoices (invoice_total still counts them).
      const invoiceTotal = (tx.invoice_total ?? 0) - exchangeTotal - buybackTotal;

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
          invoiceTotal,
          buybackTotal,
          exchangeTotal,
          creditBalance,
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
