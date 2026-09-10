// src/hooks/customer/useWalkInLookup.js
// Store-entry check via Services/POS/WalkIn/Lookup. A useMutation (not a
// useQuery) since every call writes a customer_visits row — call
// .mutate(mobile) once per staff-initiated search, never auto-refetch.
// Best-effort: failures here never block the separate billing-customer
// lookup that runs alongside it.
//
// Also logs to our own Mongo and fires a GA4/WebEngage event, since
// OrnaVerse's WalkIn/Lookup has no way to list this data back out later
// (it's a single-customer, mobile-keyed call only) — see lib/mongo/walkins.js.
// Uses the real mobile the staff typed (react-query's `variables`), not
// `result.customer.mobileMasked` — OrnaVerse's response pre-masks the
// customer's mobile (e.g. "******9991"), so the masked copy is unusable
// for retargeting.

import { useMutation } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { walkInLookup } from '@/services/customerService';
import { normalizeWalkInCustomer } from '@/lib/normalizers/customer';
import { selectAccessToken } from '@/store/slices/authSlice';
import { selectActiveStoreId, selectActiveStoreName, selectActiveStoreCode } from '@/store/slices/storeSlice';
import tracker from '@/lib/analytics/tracker';
import EVENTS from '@/lib/analytics/events';

// Mirrors tracker.js's private maskMobile() convention (last 4 digits only);
// duplicated here rather than exported since it's a 4-line helper.
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

  // GA4 gets only the PII-safe `properties` bag; real name/mobile go only in
  // webengageExtra (never reaches GA4 — see tracker.track()'s jsdoc).
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
