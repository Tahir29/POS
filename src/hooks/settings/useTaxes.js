// Applicable tax slabs for a store — read-only reference, no write endpoint
// exists (see getTaxes() in settingsService.js).

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
    // A configured-but-empty tenant ("Tax Template Not Defined!") comes back
    // as an error, not an empty list — detected here so Settings can show
    // "not configured" instead of "failed to load". serverMessage is the
    // axios interceptor's normalized error reason (lib/axios/interceptors.js).
    notConfigured: query.isError && /tax template/i.test(query.error?.serverMessage ?? ''),
    isLoading: query.isLoading,
    isError:   query.isError,
    refetch:   query.refetch,
  };
}
