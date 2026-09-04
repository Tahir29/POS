// src/hooks/analytics/useSessionTrackingContext.js
//
// Shared by every mutation hook that fires tracker.track() — Returns,
// Refunds, Credit Notes, Exchange, Buyback, URD Purchase
// (useTransactionMutations.js), Repairs (useRepairMutations.js), Schemes
// (useSchemeReceipt.js/useEnrollCustomer.js), Estimation
// (useEstimationMutations.js), Daily Closing (useCreateDailyClosing.js).
//
// EXTRACTED 2026-09-04 from useTransactionMutations.js's own local helper of
// the same shape — every one of those files had (or was about to get) the
// identical few lines: read the attached customer and active store, fall
// back to 'guest' when no customer is attached. Centralising it here means
// every mutation's success/failure event agrees on what "customer_id"/
// "store_id" mean, and a future change to the fallback (e.g. if 'guest'
// ever needs to become something else) is one file, not eight.
//
// WHY THIS EXISTS AT ALL: a create-mutation hook usually has the full
// request payload on hand at track() time (see creationDetails() in
// useTransactionMutations.js) — but Post/Cancel/Delete mutations receive
// only a bare transactionId as their mutate variable, with nothing else to
// draw on. Reading the LIVE session here (not the payload) is the only way
// those stages can carry customer_id/store_id at all.

import { useSelector } from 'react-redux';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';
import { selectActiveStoreId } from '@/store/slices/storeSlice';

/**
 * @returns {{ customer_id: number|string, store_id: number|undefined }}
 *   customer_id is the attached customer's POS id, or the literal string
 *   'guest' when none is attached — see tracker.js's own GUEST_ID for why
 *   an explicit sentinel beats omitting the field.
 */
export function useSessionTrackingContext() {
  const { customerId } = useCustomerSession();
  const activeStoreId  = useSelector(selectActiveStoreId);
  return { customer_id: customerId ?? 'guest', store_id: activeStoreId };
}
