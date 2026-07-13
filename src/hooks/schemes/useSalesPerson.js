// src/hooks/schemes/useSalesPerson.js
// Resolves the logged-in user's employee_id (= sales_person_id required by
// SchemeEnrollment/Create) and employee_name (for display), via HR/Employee/List
// filtered by user_id. user_id comes from the GetUserStores response already
// fetched at login — see selectCurrentUserId in storeSlice.js.
//
// UNVERIFIED: the `user_id` filter param on Employee/List has not been confirmed
// against a live UAT response. If Employee/List ignores this filter or uses a
// different param name, this hook will return no match — check the raw response
// shape in devtools on first real use and adjust the filter key in hrService.js
// if needed.

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import { selectCurrentUserId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';
import { getEmployeeByUserId } from '@/services/hrService';

export function useSalesPerson() {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const userId = useSelector(selectCurrentUserId);

  const query = useQuery({
    queryKey: QUERY_KEYS.HR.EMPLOYEE_BY_USER(userId),
    queryFn: async () => {
      const response = await getEmployeeByUserId(userId);
      const entities = response?.Entities ?? [];
      return entities[0] ?? null;
    },
    enabled: isAuthenticated && !!userId,
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
  });

  return {
    salesPersonId:   query.data?.employee_id ?? null,
    salesPersonName: query.data?.employee_name ?? null,
    isLoading:       query.isLoading,
    isError:         query.isError,
    error:           query.error,
  };
}