// ADDED 2026-08-21: also mirrors the found record into Mongo (see
// api/customers/sync/route.js) — the first wire-up point for the
// personalization/retargeting data layer discussed separately. Fire-and-
// forget: never blocks this lookup, never surfaces an error to the
// operator. If Mongo is briefly down, this customer's profile just doesn't
// get refreshed this time; nothing else about the sale is affected.
//
// SECURITY FIX 2026-08-21: the sync route now requires the caller's own
// bearer token (it re-fetches the authoritative record from OrnaVerse
// itself rather than trusting a client-submitted profile — see the route's
// own header) — so this has to send one. Read lazily from the store, same
// pattern axios/interceptors.js already uses, rather than turning this into
// a hook-shaped dependency for one fire-and-forget call.

import { useQuery } from '@tanstack/react-query';
import { getCustomer } from '@/services/customerService';
import { normalizeCustomer } from '@/lib/normalizers/customer';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

function syncCustomerProfile(partyId) {
  const { store } = require('@/store');
  const accessToken = store.getState().auth.accessToken;
  if (!accessToken) return; // not signed in (shouldn't happen here) — nothing to sync with

  fetch('/api/customers/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ party_id: partyId }),
  }).catch((err) => console.warn('[syncCustomerProfile] failed', err));
}

export function useCustomerLookup(mobile, options = {}) {
  const { enabled = true } = options;

  const query = useQuery({
    queryKey: QUERY_KEYS.CUSTOMERS.LOOKUP(mobile),
    queryFn:  async () => {
      const response = await getCustomer(mobile);
      const entities = response?.data?.Entities ?? [];
      if (entities.length === 0) return null;

      syncCustomerProfile(entities[0].party_id);
      return normalizeCustomer(entities[0]);
    },
    enabled:   enabled && !!mobile,
    staleTime: APP_CONFIG.STALE_TIME.CUSTOMER,
    retry:     false,
  });

  return {
    customer:  query.data    ?? null,
    isLoading: query.isFetching,
    isError:   query.isError,
    error:     query.error,
    notFound:  query.isFetched && !query.isError && query.data === null,
    refetch:   query.refetch,
  };
}