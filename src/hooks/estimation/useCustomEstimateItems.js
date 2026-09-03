import { useQuery } from '@tanstack/react-query';
import { getCustomEstimateItems } from '@/services/customEstimationService';
import { QUERY_KEYS } from '@/constants/queryKeys';

/**
 * Item-master rows eligible for Custom Estimation. Rarely changes (it's a
 * per-item master-data flag, not live pricing) — cached for the session,
 * same as other master-data lists in this app.
 */
export function useCustomEstimateItems() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey:  QUERY_KEYS.ITEMS.CUSTOM_ESTIMATE_LIST(),
    queryFn:   getCustomEstimateItems,
    staleTime: Infinity, // refetch() covers the rare case this flag changes mid-session
  });

  return {
    items: data ?? [],
    isLoading,
    isError,
    refetch,
  };
}