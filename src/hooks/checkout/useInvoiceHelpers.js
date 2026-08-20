// src/hooks/checkout/useInvoiceHelpers.js
// Fetches all available customer balances at checkout time.
// Called when a customer is attached and the payment section renders.
//
// REBUILT 2026-08-18 — the previous version called 5 separate endpoints
// (POSInvoice/GetAdvances/GetCreditNote/GetExchange/GetOldGold/GetScheme),
// all of which 500 on this tenant. Confirmed by driving OrnaVerse's own POS
// end to end (Invoice tab, real customer Tahir Kutty, party_id 2221) while
// capturing every /Services/ call: their own payment screen never calls any
// of those five. The one call it actually makes is POSReceiptsSelect/List
// with just `{ party_id }` — it returns every outstanding credit-bearing
// receipt for that party in one flat list, and their screen sums every
// row's balance_amount into the single "Credit" figure shown on the
// customer card (verified: summed to exactly ₹4,71,510.00, matching the
// display). See the comment on API.INVOICE_HELPERS for the full capture.
//
// This hook rebuilds the 5 category totals the existing UI
// (CheckoutPaymentSection) already shows by bucketing those rows by
// `document_id` (APP_CONFIG.DOCUMENT_TYPES) — their own UI shows one
// unified list instead, we keep the categorized display already built here.
// Only RETURN (55) and EXCHANGE (56) rows were present on the real account
// this was verified against; ADVANCE/OLD_GOLD/SCHEME buckets are wired the
// same way but unverified against a live receipt of those types.
//
// NOTE — applying a bucket total is NOT yet wired to reference the specific
// receipt(s) it's drawn from (transaction_id / document_no / ledger_id —
// the shape refundService.js's toRefundReceipt() already proves is needed
// to knock a credit off correctly). `rows` is exposed per bucket below so
// that wiring can be built without another data-fetching change, but
// CheckoutPaymentSection's helper-toggle still applies a flat amount with
// no linkage — see its own comment before trusting "Apply" to settle a
// balance for real. refundService.js's own header comment records that the
// analogous knock-off mechanism for Refund does NOT actually settle the
// credit on this tenant even when built by the book, so this needs a live
// capture of an Invoice (not Refund) actually being paid with credit before
// that linkage gets guessed at.
//
// Each query is independent — partial failures don't block others.
// Results shown as "Apply" toggles in CheckoutPaymentSection.

import { useQuery } from '@tanstack/react-query';
import { getPartyReceipts, getPartyDailyCash } from '@/services/orderService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

const { DOCUMENT_TYPES } = APP_CONFIG;

// document_id → which "Available Balances" bucket it feeds.
const BUCKET_BY_DOCUMENT_ID = {
  [DOCUMENT_TYPES.RETURN]:         'creditNote',
  [DOCUMENT_TYPES.EXCHANGE]:       'exchange',
  [DOCUMENT_TYPES.URD_PURCHASE]:   'oldGold',
  [DOCUMENT_TYPES.SCHEME_RECEIPT]: 'scheme',
  [DOCUMENT_TYPES.POS_ORDER]:      'advances',
  [DOCUMENT_TYPES.POS_INVOICE]:    'advances',
};

const EMPTY_BUCKETS = { creditNote: [], exchange: [], oldGold: [], scheme: [], advances: [] };

function bucketReceipts(rows) {
  const buckets = { creditNote: [], exchange: [], oldGold: [], scheme: [], advances: [] };
  for (const row of rows) {
    const bucket = BUCKET_BY_DOCUMENT_ID[row.document_id];
    if (bucket) buckets[bucket].push(row);
  }
  return buckets;
}

function sumBalance(rows) {
  return rows.reduce((sum, r) => sum + (Number(r.balance_amount) || 0), 0);
}

/**
 * @param {{ partyId: number|null, companyId: number|null }} params
 */
export function useInvoiceHelpers({ partyId, companyId }) {
  const enabled = !!partyId && !!companyId;

  const receiptsQuery = useQuery({
    queryKey:  QUERY_KEYS.INVOICE_HELPERS.RECEIPTS(partyId),
    queryFn:   () => getPartyReceipts({ party_id: partyId }),
    enabled:   !!partyId,
    staleTime: APP_CONFIG.STALE_TIME.CUSTOMER,
    retry:     false,
  });

  const dailyCash = useQuery({
    queryKey:  QUERY_KEYS.INVOICE_HELPERS.PARTY_DAILY_CASH(partyId, companyId),
    queryFn:   () => getPartyDailyCash({ party_id: partyId, company_id: companyId }),
    enabled,
    staleTime: APP_CONFIG.STALE_TIME.CUSTOMER,
    retry:     false,
  });

  const buckets = receiptsQuery.data ? bucketReceipts(receiptsQuery.data) : EMPTY_BUCKETS;

  function bucketResult(key) {
    return {
      amount:    sumBalance(buckets[key]),
      rows:      buckets[key], // underlying receipts — see NOTE above before wiring "apply" to these
      isLoading: receiptsQuery.isLoading,
      isError:   receiptsQuery.isError,
    };
  }

  // dailyCash's own response shape isn't independently confirmed here —
  // read the common amount field patterns, same fallback as before.
  function extractAmount(queryResult) {
    const d = queryResult.data;
    if (!d) return 0;
    return d?.amount ?? d?.balance ?? d?.available_amount ?? d?.Entity?.amount ?? 0;
  }

  return {
    advances:   bucketResult('advances'),
    creditNote: bucketResult('creditNote'),
    exchange:   bucketResult('exchange'),
    oldGold:    bucketResult('oldGold'),
    scheme:     bucketResult('scheme'),
    dailyCash:  { amount: extractAmount(dailyCash), isLoading: dailyCash.isLoading, isError: dailyCash.isError },

    // True when any helper has a non-zero available amount
    hasAnyBalance: ['advances', 'creditNote', 'exchange', 'oldGold', 'scheme']
      .some((key) => sumBalance(buckets[key]) > 0),

    isLoading: receiptsQuery.isLoading || dailyCash.isLoading,
  };
}
