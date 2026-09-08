// Store-entry check via Services/POS/WalkIn/Lookup.
//
// A useMutation, not a useQuery: every call WRITES a customer_visits row
// against the active store, so it must fire exactly once per staff-initiated
// mobile search — never auto-refetch/cache-invalidate like a read endpoint
// would. Call .mutate(mobile) directly from the search submit handler.
//
// Best-effort: failures here should never block the existing party (billing
// customer) lookup that runs alongside it — this is a visit-tracking/greeting
// signal, not the source of truth for whether the customer can be billed.
//
// ALSO logs to our own Mongo, and fires a GA4/WebEngage event (added
// 2026-09-08) — see lib/mongo/walkins.js's own header for why: OrnaVerse's
// WalkIn/Lookup has no way to list this data back out later (confirmed
// live — it's a single-customer, mobile-keyed call only), so there's
// nowhere else for a "walk-ins for this store" retargeting page — or a
// GA4/WebEngage report — to read from except a log this app keeps itself.
// Written/fired the moment OrnaVerse reports `found: true` — the same
// definition of "a walk-in was recorded" OrnaVerse itself uses
// (WalkInRecorded), not on every keystroke/search attempt that comes up
// empty. Both are fire-and-forget: neither ever blocks or fails this
// hook's own result, same "best-effort" reasoning as the header above
// already establishes for this whole call.
//
// REAL MOBILE, NOT MASKED (2026-09-08 fix) — OrnaVerse's own WalkIn/Lookup
// response pre-masks Customer.mobile ("******9991", same masking
// documented elsewhere for Customer/List — see apiEndpoints.js's WALKIN
// comment), so `result.customer.mobileMasked` is NOT usable for
// retargeting. The one real, unmasked number this call ever has is
// whatever staff actually typed to search — react-query's onSuccess
// receives that back as its own second argument (`variables`, the exact
// value passed to `lookup(mobile)`/`mutation.mutate(mobile)`), so that's
// what's stored/tracked here instead of the response's masked copy.

import { useMutation } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { walkInLookup } from '@/services/customerService';
import { normalizeWalkInCustomer } from '@/lib/normalizers/customer';
import { selectAccessToken } from '@/store/slices/authSlice';
import { selectActiveStoreId, selectActiveStoreName, selectActiveStoreCode } from '@/store/slices/storeSlice';
import tracker from '@/lib/analytics/tracker';
import EVENTS from '@/lib/analytics/events';

// Last 4 digits only — matches tracker.js's own maskMobile() convention
// (not imported from there: that one's a private, unexported helper, and
// duplicating a 4-line mask is simpler than exporting it just for this).
function maskMobile(mobile) {
  if (!mobile) return null;
  const digits = String(mobile).replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

function logWalkIn({ mobile, customer, accessToken, companyId, companyName, companyCode, agentUsername }) {
  if (!accessToken || !companyId) return; // nothing to scope this record to

  fetch('/api/customers/walkins', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      mobile,
      customerName:     customer.name,
      walkInCustomerId: customer.walkInCustomerId,
      company_id:       companyId,
      companyName,
      companyCode,
      agentUsername,
    }),
  }).catch((err) => console.warn('[useWalkInLookup] walk-in log failed:', err));

  // GA4 + WebEngage (see this file's own header for the full split) — GA4
  // only ever gets the PII-safe `properties` bag (store data, the CRM-level
  // walk-in id, a masked mobile); the real name/mobile go ONLY in
  // webengageExtra, which never reaches GA4 (see tracker.track()'s own
  // jsdoc). `timestamp` (walk-in date/time) is stamped automatically by
  // tracker.track() itself on both destinations — not duplicated here.
  tracker.track(
    EVENTS.WALKIN_RECORDED,
    {
      store_id:               companyId,
      store_name:             companyName,
      store_code:             companyCode,
      walk_in_customer_id:    customer.walkInCustomerId,
      customer_mobile_masked: maskMobile(mobile),
    },
    {
      customer_name:   customer.name,
      customer_mobile: mobile,
    },
  );
}

export function useWalkInLookup() {
  const accessToken = useSelector(selectAccessToken);
  const companyId    = useSelector(selectActiveStoreId);
  const companyName  = useSelector(selectActiveStoreName);
  const companyCode  = useSelector(selectActiveStoreCode);
  const agentUsername = useSelector((state) => state.auth?.user?.username ?? null);

  const mutation = useMutation({
    mutationFn: async (mobile) => {
      const response = await walkInLookup(mobile);
      const data = response?.data;
      return {
        found:    !!data?.Customer,
        customer: normalizeWalkInCustomer(data?.Customer),
      };
    },
    // `mobile` here is react-query's own `variables` — the exact argument
    // passed to mutate(mobile)/lookup(mobile) — see this file's header for
    // why that (not result.customer.mobileMasked) is the real number.
    onSuccess: (result, mobile) => {
      if (result.found && result.customer) {
        logWalkIn({ mobile, customer: result.customer, accessToken, companyId, companyName, companyCode, agentUsername });
      }
    },
  });

  return {
    lookup:    mutation.mutate,
    result:    mutation.data ?? null,
    isLoading: mutation.isPending,
    reset:     mutation.reset,
  };
}
