import { useQuery } from '@tanstack/react-query';
import { getInterstoreReturnDetail } from '@/services/interstoreReturnService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

/** @param {number|null} interstoreReturnId */
export function useInterstoreReturnDetail(interstoreReturnId) {
  const query = useQuery({
    queryKey: QUERY_KEYS.INTERSTORE_RETURN.DETAIL(interstoreReturnId),
    queryFn: () => getInterstoreReturnDetail(interstoreReturnId),
    enabled: !!interstoreReturnId,
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  return {
    entity: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
