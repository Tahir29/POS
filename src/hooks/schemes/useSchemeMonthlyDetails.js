// src/hooks/schemes/useSchemeMonthlyDetails.js
// Month-by-month payment schedule for a single scheme enrollment.
//
// Confirmed live 2026-07-22 — Services/POS/SchemeMonthlyDetails/List
// returns { Entities: SchemeMonthlyDetailsRow[] }, each row:
//   scheme_monthly_details_id, scheme_enrollment_id, month_id, month_amount,
//   weight, payment_made (bool), due_date, paid_on_date (only when paid),
//   delay_days, party_id, gold_rate

import { useQuery } from '@tanstack/react-query';
import { getSchemeMonthlyDetails } from '@/services/schemeService';
import { QUERY_KEYS } from '@/constants/queryKeys';

function normalizeMonth(raw) {
  const isOverdue = !raw.payment_made && !!raw.due_date && new Date(raw.due_date) < new Date();

  return {
    id:         raw.scheme_monthly_details_id,
    monthId:    raw.month_id,
    amount:     raw.month_amount ?? 0,
    isPaid:     !!raw.payment_made,
    isOverdue,
    dueDate:    raw.due_date ?? null,
    paidOnDate: raw.paid_on_date ?? null,
    delayDays:  raw.delay_days ?? 0,
    raw,
  };
}

/**
 * @param {number|null} enrollmentId — scheme_enrollment_id, or null/undefined to disable.
 */
export function useSchemeMonthlyDetails(enrollmentId) {
  return useQuery({
    queryKey: QUERY_KEYS.SCHEMES.MONTHLY_DETAILS(enrollmentId),
    queryFn: async () => {
      const data = await getSchemeMonthlyDetails({ scheme_enrollment_id: enrollmentId });
      const rows = data?.Entities ?? [];
      // Sort by month_id — API order isn't guaranteed to be chronological.
      return rows.map(normalizeMonth).sort((a, b) => a.monthId - b.monthId);
    },
    enabled: !!enrollmentId,
  });
}
