// src/hooks/customer/useCustomerEnrollments.js
// Scheme enrollments for a specific customer.
// Now passes party_id to the service for server-side filtering.
//
// SCHEMA — POS.SchemeEnrollmentRow confirmed fields:
//   scheme_enrollment_id, party_id, party_name, mobile
//   scheme_display_name, scheme_code, scheme_status (enum SchemeStatus)
//   document_date, scheme_amount, tenure
//   invested_amount, benifit_amount (⚠️ API typo — preserve exactly)
//   total_payable, scheme_monthly_details[]

import { useQuery } from '@tanstack/react-query';
import { getSchemeEnrollments } from '@/services/schemeService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

function isEmptyValue(v) {
  return v === null || v === undefined || v === 'NA' || v === '';
}

export function normalizeEnrollment(entity) {
  if (!entity) return null;
  const get = (key) => (!isEmptyValue(entity[key]) ? entity[key] : null);

  return {
    enrollmentId:    get('scheme_enrollment_id'),
    schemeName:      get('scheme_display_name') ?? get('scheme_code'),
    schemeCode:      get('scheme_code'),
    status:          get('scheme_status'),       // SchemeStatus enum
    enrolledDate:    get('document_date'),
    schemeAmount:    get('scheme_amount'),
    tenure:          get('tenure'),
    investedAmount:  get('invested_amount'),
    benifitAmount:   get('benifit_amount'),       // ⚠️ preserve API typo
    totalPayable:    get('total_payable'),
    maturityYear:    get('maturity_year'),
    maturityMonth:   get('maturity_month'),
    customerId:      get('party_id'),
    customerName:    get('party_name'),
    customerMobile:  get('mobile'),
    raw: entity,
  };
}

export function useCustomerEnrollments({ customerId, enabled = true } = {}) {
  const query = useQuery({
    queryKey: QUERY_KEYS.SCHEMES.CUSTOMER_ENROLLMENTS(customerId ?? 'none'),
    queryFn:  async () => {
      // Pass party_id for server-side filtering — no client-side filter needed
      const data     = await getSchemeEnrollments({ take: 0, party_id: customerId });
      // SchemeEnrollment/List may return bare array or wrapped Entities
      const entities = Array.isArray(data)
        ? data
        : (data?.Entities ?? data?.data ?? []);
      return entities.map(normalizeEnrollment).filter(Boolean);
    },
    enabled:   enabled && !!customerId,
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  return {
    enrollments: query.data ?? [],
    isLoading:   query.isLoading,
    isFetching:  query.isFetching,
    isError:     query.isError,
    refetch:     query.refetch,
  };
}