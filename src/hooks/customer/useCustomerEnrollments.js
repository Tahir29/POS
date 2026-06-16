// src/hooks/customer/useCustomerEnrollments.js
// Customer scheme enrollments — Phase 10 Customer Detail page.
// Maps to: POST Services/POS/SchemeEnrollment/List (Take: 0 = all records)
//
// SchemeEnrollment/List response shape is UNCONFIRMED. Following the same
// Entities[]/TotalCount convention as other /List endpoints, with
// best-effort field names and fallbacks:
//   customerId    <- party_id ?? customer_id
//   schemeName    <- scheme_name ?? scheme_title
//   status        <- enrollment_status ?? status
//   enrolledDate  <- enrolled_date ?? document_date ?? created_date
//   schemeAmount  <- scheme_amount ?? amount
//
// Client-side filtered by the viewed customer's party_id, falling back to
// mobile number matching if party_id isn't present on enrollment records.

import { useQuery } from '@tanstack/react-query';
import { getSchemeEnrollments } from '@/services/schemeService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

function isEmptyValue(value) {
  return value === null || value === undefined || value === 'NA' || value === '';
}

/**
 * Normalizes an OrnaVerse scheme enrollment record for display.
 */
export function normalizeEnrollment(entity) {
  if (!entity) return null;
  const get = (key) => (!isEmptyValue(entity[key]) ? entity[key] : null);

  return {
    enrollmentId: get('scheme_enrollment_id') ?? get('enrollment_id') ?? get('transaction_id'),
    schemeName:   get('scheme_name') ?? get('scheme_title'),
    status:       get('enrollment_status') ?? get('status'),
    enrolledDate: get('enrolled_date') ?? get('document_date') ?? get('created_date'),
    schemeAmount: get('scheme_amount') ?? get('amount'),
    customerId:   get('party_id') ?? get('customer_id'),
    customerMobile: get('mobile'),
    raw: entity,
  };
}

/**
 * Fetches all scheme enrollments and filters down to those belonging to
 * the given customer (matched by party_id, falling back to mobile number).
 *
 * @param {{ customerId?: number|string|null, customerMobile?: string|null, enabled?: boolean }} params
 */
export function useCustomerEnrollments({ customerId, customerMobile, enabled = true } = {}) {
  const query = useQuery({
    queryKey: QUERY_KEYS.SCHEMES.CUSTOMER_ENROLLMENTS(customerId ?? customerMobile ?? 'none'),
    queryFn: async () => {
      const response = await getSchemeEnrollments({ take: 0 });
      const entities = response?.Entities ?? response?.data ?? response?.result ?? [];
      return entities.map(normalizeEnrollment).filter(Boolean);
    },
    enabled: enabled && (!!customerId || !!customerMobile),
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  const allEnrollments = query.data ?? [];
  const enrollments = allEnrollments.filter((enrollment) => {
    if (customerId != null && enrollment.customerId != null) {
      return String(enrollment.customerId) === String(customerId);
    }
    if (customerMobile && enrollment.customerMobile) {
      return enrollment.customerMobile === customerMobile;
    }
    return false;
  });

  return {
    enrollments,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
}