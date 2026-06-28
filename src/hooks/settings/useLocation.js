// src/hooks/settings/useLocation.js
// Cascading location dropdowns: Countries → States → Cities.
// Each level enabled only when parent selection is made.
// Cached for STALE_TIME.STATIC (30 min).
//
// FIX: Added isAuthenticated guard — without it, queries fired before
// the token was ready, got a 401, errored silently, and never retried
// due to the 30-min staleTime. Dropdowns appeared empty forever.

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getCountries, getStates, getCities } from '@/services/locationService';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

export function useCountries({ enabled = true } = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const query = useQuery({
    queryKey: QUERY_KEYS.LOCATION.COUNTRIES(),
    queryFn:  async () => {
      const data = await getCountries();
      return data?.Entities ?? [];
    },
    enabled:   enabled && isAuthenticated,  // ← auth guard added
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
    retry:     1,
  });

  return {
    countries:  query.data ?? [],
    isLoading:  query.isLoading,
    isError:    query.isError,
  };
}

export function useStates(countryId, { enabled = true } = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const query = useQuery({
    queryKey: QUERY_KEYS.LOCATION.STATES(countryId),
    queryFn:  async () => {
      const data = await getStates({ country_id: countryId });
      return data?.Entities ?? [];
    },
    enabled:   enabled && isAuthenticated && !!countryId,  // ← auth guard added
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
    retry:     1,
  });

  return {
    states:    query.data ?? [],
    isLoading: query.isLoading,
    isError:   query.isError,
  };
}

export function useCities(stateId, { enabled = true } = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const query = useQuery({
    queryKey: QUERY_KEYS.LOCATION.CITIES(stateId),
    queryFn:  async () => {
      const data = await getCities({ state_id: stateId });
      return data?.Entities ?? [];
    },
    enabled:   enabled && isAuthenticated && !!stateId,  // ← auth guard added
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
    retry:     1,
  });

  return {
    cities:    query.data ?? [],
    isLoading: query.isLoading,
    isError:   query.isError,
  };
}