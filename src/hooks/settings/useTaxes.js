// src/hooks/settings/useTaxes.js
// Applicable tax slabs for a store — read-only reference, no write endpoint
// exists for this (see settingsService.js getTaxes header for the required
// exchange_rate field and the "Tax Template Not Defined!" per-store gap).

import { useQuery } from '@tanstack/react-query';
import { getTaxes } from '@/services/settingsService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

export function useTaxes(companyId) {
  const query = useQuery({
    queryKey: QUERY_KEYS.SETTINGS.TAXES(companyId),
    queryFn:  () => getTaxes({ company_id: companyId }),
    enabled:  !!companyId,
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
    retry: false,
  });

  return {
    taxes:    query.data?.Entities ?? [],
    // A configured-but-empty tenant ("Tax Template Not Defined!") comes
    // back as a real error, not an empty list — surfaced distinctly so the
    // Settings screen can say "not configured" rather than "failed to load".
    // serverMessage is the axios interceptor's own normalized OrnaVerse
    // reason (see lib/axios/interceptors.js normalizeError) — never reach
    // into raw response.data here, callers get the normalized error object.
    notConfigured: query.isError && /tax template/i.test(query.error?.serverMessage ?? ''),
    isLoading: query.isLoading,
    isError:   query.isError,
    refetch:   query.refetch,
  };
}
