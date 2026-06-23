// src/hooks/customer/useCustomerEnrollments.js
import { useQuery } from '@tanstack/react-query';
import { getSchemeEnrollments } from '@/services/schemeService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

function isEmptyValue(value) {
  return value === null || value === undefined || value === 'NA' || value === '';
}

export function normalizeEnrollment(entity) {
  if (!entity) return null;
  const get = (key) => (!isEmptyValue(entity[key]) ? entity[key] : null);

  return {
    enrollmentId:   get('scheme_enrollment_id'),
    schemeName:     get('scheme_display_name') ?? get('scheme_code'),
    status:         get('scheme_status'),           // 0 or 1 (int)
    enrolledDate:   get('document_date'),
    schemeAmount:   get('scheme_amount'),
    tenure:         get('tenure'),
    customerId:     get('party_id'),
    customerName:   get('party_name'),
    customerMobile: get('mobile'),
    raw: entity,
  };
}

export function useCustomerEnrollments({ customerId, customerMobile, enabled = true } = {}) {
  const query = useQuery({
    queryKey: QUERY_KEYS.SCHEMES.CUSTOMER_ENROLLMENTS(customerId ?? customerMobile ?? 'none'),
    queryFn: async () => {
      const response = await getSchemeEnrollments({ take: 0 });
      // Response is a bare array — no Entities wrapper
      const entities = Array.isArray(response)
        ? response
        : (response?.Entities ?? response?.data ?? response?.result ?? []);
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
    isLoading:  query.isLoading,
    isFetching: query.isFetching,
    isError:    query.isError,
    refetch:    query.refetch,
  };
}