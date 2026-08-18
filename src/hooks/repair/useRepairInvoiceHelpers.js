// src/hooks/repair/useRepairInvoiceHelpers.js
//
// Available customer balances at REPAIR billing time — the repair-specific
// counterpart of useInvoiceHelpers.js. Same 4 sources exist for repairs
// (Advances/Scheme/CreditNote/Exchange — no OldGold or DailyCash equivalent
// documented for this flow) and were fully implemented in the service layer
// (repairService.js) but never called from anywhere — see repair/page.jsx's
// RepairInvoiceNewForm, which used to take only a single flat payment mode.
//
// UNVERIFIED LIVE, same caveat as the rest of this session's Repair work —
// these 4 endpoints have never been round-tripped against real UAT data
// (unlike useInvoiceHelpers' endpoints, which have real traffic behind
// them). Treat a failure here as "diagnose live," not "code is wrong."

import { useQuery } from '@tanstack/react-query';
import {
  getRepairInvoiceAdvances,
  getRepairInvoiceScheme,
  getRepairInvoiceCreditNote,
  getRepairInvoiceExchange,
} from '@/services/repairService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

function helperQuery(queryKey, queryFn, enabled) {
  return { queryKey, queryFn, enabled, staleTime: APP_CONFIG.STALE_TIME.CUSTOMER, retry: false };
}

function extractAmount(data) {
  if (!data) return 0;
  return data?.amount ?? data?.balance ?? data?.available_amount ?? data?.Entity?.amount ?? 0;
}

/**
 * @param {{ partyId: number|null, companyId: number|null }} params
 */
export function useRepairInvoiceHelpers({ partyId, companyId }) {
  const enabled = !!partyId && !!companyId;
  const params  = { party_id: partyId, company_id: companyId };

  const advances = useQuery(helperQuery(
    QUERY_KEYS.REPAIR_INVOICE_HELPERS.ADVANCES(partyId, companyId),
    () => getRepairInvoiceAdvances(params),
    enabled,
  ));
  const scheme = useQuery(helperQuery(
    QUERY_KEYS.REPAIR_INVOICE_HELPERS.SCHEME(partyId, companyId),
    () => getRepairInvoiceScheme(params),
    enabled,
  ));
  const creditNote = useQuery(helperQuery(
    QUERY_KEYS.REPAIR_INVOICE_HELPERS.CREDIT_NOTE(partyId, companyId),
    () => getRepairInvoiceCreditNote(params),
    enabled,
  ));
  const exchange = useQuery(helperQuery(
    QUERY_KEYS.REPAIR_INVOICE_HELPERS.EXCHANGE(partyId, companyId),
    () => getRepairInvoiceExchange(params),
    enabled,
  ));

  const balances = [
    { code: 'Advance',    label: 'Advance',     amount: extractAmount(advances.data),   isLoading: advances.isLoading,   isError: advances.isError },
    { code: 'Scheme',     label: 'Scheme',      amount: extractAmount(scheme.data),      isLoading: scheme.isLoading,      isError: scheme.isError },
    { code: 'CreditNote', label: 'Credit Note', amount: extractAmount(creditNote.data), isLoading: creditNote.isLoading, isError: creditNote.isError },
    { code: 'Exchange',   label: 'Exchange',    amount: extractAmount(exchange.data),   isLoading: exchange.isLoading,   isError: exchange.isError },
  ];

  return {
    balances,
    hasAnyBalance: balances.some((b) => b.amount > 0),
    isLoading: balances.some((b) => b.isLoading),
  };
}
