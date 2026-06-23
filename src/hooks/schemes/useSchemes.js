// src/hooks/schemes/useSchemes.js
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';
import { getSchemes } from '@/services/schemeService';

export function useSchemes() {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const query = useQuery({
    queryKey: QUERY_KEYS.SCHEMES.LIST(),
    queryFn: async () => {
      const response = await getSchemes();
      return response?.Entities ?? [];
    },
    enabled: isAuthenticated,
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
  });

  return {
    schemes:   query.data ?? [],
    isLoading: query.isLoading,
    isError:   query.isError,
    error:     query.error,
    refetch:   query.refetch,
  };
}