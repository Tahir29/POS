// src/hooks/customer/useCustomerLookup.js
// Looks up a customer by mobile; on a hit, also fires a fire-and-forget sync
// to Mongo (api/customers/sync) for the personalization/retargeting data layer.
// The sync call requires a bearer token — read lazily from the store rather
// than adding a hook-level dependency for one background call.

import { useQuery } from '@tanstack/react-query';
import { getCustomer } from '@/services/customerService';
import { normalizeCustomer } from '@/lib/normalizers/customer';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

function syncCustomerProfile(partyId) {
  const { store } = require('@/store');
  const accessToken = store.getState().auth.accessToken;
  if (!accessToken) return; // no token — nothing to sync with

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