// src/hooks/checkout/useInvoiceHelpers.js
// Fetches all available customer balances at checkout time.
// Called when a customer is attached and the payment section renders.
//
// Sources (all confirmed in v1.json):
//   POSInvoice/GetAdvances      — advance payments customer has deposited
//   POSInvoice/GetCreditNote    — store credit from past credit notes
//   POSInvoice/GetExchange      — value from a pending exchange transaction
//   POSInvoice/GetOldGold       — value from a pending old gold/URD purchase
//   POSInvoice/GetScheme        — matured/available scheme balance
//   POSInvoice/GetPartyDailyCash — daily cash position at this store
//
// Each query is independent — partial failures don't block others.
// Results shown as "Apply" toggles in CheckoutPaymentSection.

import { useQuery } from '@tanstack/react-query';
import {
  getInvoiceAdvances,
  getInvoiceCreditNote,
  getInvoiceExchange,
  getInvoiceOldGold,
  getInvoiceScheme,
  getPartyDailyCash,
} from '@/services/orderService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

function helperQuery(queryKey, queryFn, enabled) {
  return { queryKey, queryFn, enabled, staleTime: APP_CONFIG.STALE_TIME.CUSTOMER, retry: false };
}

/**
 * @param {{ partyId: number|null, companyId: number|null }} params
 */
export function useInvoiceHelpers({ partyId, companyId }) {
  const enabled = !!partyId && !!companyId;
  const params  = { party_id: partyId, company_id: companyId };

  const advances = useQuery(helperQuery(
    QUERY_KEYS.INVOICE_HELPERS.ADVANCES(partyId, companyId),
    () => getInvoiceAdvances(params),
    enabled,
  ));

  const creditNote = useQuery(helperQuery(
    QUERY_KEYS.INVOICE_HELPERS.CREDIT_NOTE(partyId, companyId),
    () => getInvoiceCreditNote(params),
    enabled,
  ));

  const exchange = useQuery(helperQuery(
    QUERY_KEYS.INVOICE_HELPERS.EXCHANGE(partyId, companyId),
    () => getInvoiceExchange(params),
    enabled,
  ));

  const oldGold = useQuery(helperQuery(
    QUERY_KEYS.INVOICE_HELPERS.OLD_GOLD(partyId, companyId),
    () => getInvoiceOldGold(params),
    enabled,
  ));

  const scheme = useQuery(helperQuery(
    QUERY_KEYS.INVOICE_HELPERS.SCHEME(partyId, companyId),
    () => getInvoiceScheme(params),
    enabled,
  ));

  const dailyCash = useQuery(helperQuery(
    QUERY_KEYS.INVOICE_HELPERS.PARTY_DAILY_CASH(partyId, companyId),
    () => getPartyDailyCash(params),
    enabled,
  ));

  // Extract the available amount from each response.
  // Exact response shapes TBD per UAT — reading common amount field patterns.
  function extractAmount(queryResult) {
    const d = queryResult.data;
    if (!d) return 0;
    return d?.amount ?? d?.balance ?? d?.available_amount ?? d?.Entity?.amount ?? 0;
  }

  return {
    advances:    { amount: extractAmount(advances),   isLoading: advances.isLoading,   isError: advances.isError },
    creditNote:  { amount: extractAmount(creditNote), isLoading: creditNote.isLoading, isError: creditNote.isError },
    exchange:    { amount: extractAmount(exchange),   isLoading: exchange.isLoading,   isError: exchange.isError },
    oldGold:     { amount: extractAmount(oldGold),    isLoading: oldGold.isLoading,    isError: oldGold.isError },
    scheme:      { amount: extractAmount(scheme),     isLoading: scheme.isLoading,     isError: scheme.isError },
    dailyCash:   { amount: extractAmount(dailyCash),  isLoading: dailyCash.isLoading,  isError: dailyCash.isError },

    // True when any helper has a non-zero available amount
    hasAnyBalance: [advances, creditNote, exchange, oldGold, scheme]
      .some((q) => extractAmount(q) > 0),

    isLoading: [advances, creditNote, exchange, oldGold, scheme, dailyCash]
      .some((q) => q.isLoading),
  };
}