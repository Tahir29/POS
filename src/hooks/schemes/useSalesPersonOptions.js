// src/hooks/schemes/useSalesPersonOptions.js
// Employees at the active store, for the "Sales Person" picker on scheme
// enrollment. sales_person_id on SchemeEnrollmentRow is confirmed required
// (v1.json) — this mirrors the vendor's own Scheme Enrollment screen, which
// filters HR/Employee/List by company_id and lets staff pick, rather than
// auto-resolving from the logged-in user (confirmed via real UAT response,
// 2026-07-13 — no user_id was involved).

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';
import { getEmployeesByCompany } from '@/services/hrService';

export function useSalesPersonOptions(companyId) {
  const query = useQuery({
    queryKey: QUERY_KEYS.HR.EMPLOYEES_BY_COMPANY(companyId),
    queryFn: async () => {
      const response = await getEmployeesByCompany(companyId);
      return response?.Entities ?? [];
    },
    enabled: !!companyId,
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
  });

  return {
    salesPersons: query.data ?? [],
    isLoading:    query.isLoading,
    isError:      query.isError,
    error:        query.error,
  };
}