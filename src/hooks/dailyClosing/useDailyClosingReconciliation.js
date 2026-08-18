// src/hooks/dailyClosing/useDailyClosingReconciliation.js
//
// Real payment-mode receipt totals for the active store on a given date —
// lets the manual EOD entry form be checked against something real instead
// of being 100% typed from memory. See dailyClosingService.js header for
// the endpoint this reuses and its confirmed reliability (works for 4 of
// this tenant's 6 stores; company_id 1 and 4 both 500 on this call today).
//
// A failure here is reported as store-specific and non-fatal — the manual
// entry form still works without it, this is a check, not a dependency.

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getReceiptModeTotals } from '@/services/dailyClosingService';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';

// Naive LOCAL day boundaries, no timezone suffix — same convention as
// localDocumentDate (lib/checkout/documentFields.js): OrnaVerse's own
// client never sends UTC-converted timestamps, and a sale near midnight
// IST would land in the wrong day's bucket if this did.
function localDayBounds(dateString) {
  return {
    fromDate: `${dateString}T00:00:00.000`,
    toDate:   `${dateString}T23:59:59.999`,
  };
}

// Best-effort grouping of OrnaVerse's real mode labels (seen live: Cash,
// Credit Card, Debit Card, UPI, GoKwik, Razorpay, NEFT, Old Gold, Advance,
// Order Advance, Return, Exchange, Cash On Delivery) into the 4 buckets
// this app's EOD form has always collected. Not a precise accounting
// mapping (Return/Exchange are money OUT, not sales), just enough to give
// staff a real number to check their count against — labeled honestly in
// the UI as "system-recorded receipts", not "sales".
function bucketFor(modeName) {
  const m = (modeName ?? '').toLowerCase();
  if (m === 'cash') return 'cash';
  if (m.includes('card')) return 'card';
  if (m === 'upi') return 'upi';
  return 'other';
}

/**
 * @param {string} dateString — 'YYYY-MM-DD', the same value the EOD form's
 *   date field holds.
 */
export function useDailyClosingReconciliation(dateString) {
  const companyId = useSelector(selectActiveStoreId);

  const query = useQuery({
    queryKey: QUERY_KEYS.DAILY_CLOSING.RECONCILIATION(companyId, dateString),
    queryFn: () => {
      const { fromDate, toDate } = localDayBounds(dateString);
      return getReceiptModeTotals({ companyId, fromDate, toDate });
    },
    enabled: !!companyId && !!dateString,
    staleTime: 60 * 1000,
  });

  const modes = query.data?.Entities ?? [];

  const buckets = modes.reduce(
    (acc, row) => {
      const bucket = bucketFor(row.mode);
      acc[bucket] += Number(row.amount) || 0;
      return acc;
    },
    { cash: 0, card: 0, upi: 0, other: 0 }
  );

  const total = buckets.cash + buckets.card + buckets.upi + buckets.other;

  return {
    modes,
    buckets,
    total,
    hasData:    modes.length > 0,
    isLoading:  query.isLoading,
    isError:    query.isError,
    refetch:    query.refetch,
  };
}
