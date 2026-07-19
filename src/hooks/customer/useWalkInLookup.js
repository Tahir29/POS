// src/hooks/customer/useWalkInLookup.js
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

import { useMutation } from '@tanstack/react-query';
import { walkInLookup } from '@/services/customerService';
import { normalizeWalkInCustomer } from '@/lib/normalizers/customer';

export function useWalkInLookup() {
  const mutation = useMutation({
    mutationFn: async (mobile) => {
      const response = await walkInLookup(mobile);
      const data = response?.data;
      return {
        found:    !!data?.Customer,
        customer: normalizeWalkInCustomer(data?.Customer),
      };
    },
  });

  return {
    lookup:    mutation.mutate,
    result:    mutation.data ?? null,
    isLoading: mutation.isPending,
    reset:     mutation.reset,
  };
}
