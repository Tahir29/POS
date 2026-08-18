// src/hooks/settings/useReasonCodes.js
// Reason codes (returns/cancellations/exchanges) — read-only reference.
// CONFIRMED BROKEN server-side as of 2026-08-14 — see getReasonCodes'
// header in settingsService.js. isError will be true unconditionally on
// this tenant right now; that's the server, not this hook.

import { useQuery } from '@tanstack/react-query';
import { getReasonCodes } from '@/services/settingsService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

export function useReasonCodes() {
  const query = useQuery({
    queryKey: QUERY_KEYS.SETTINGS.REASON_CODES(),
    queryFn:  getReasonCodes,
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
    retry: false,
  });

  return {
    reasonCodes: query.data?.Entities ?? [],
    isLoading:   query.isLoading,
    isError:     query.isError,
    refetch:     query.refetch,
  };
}
