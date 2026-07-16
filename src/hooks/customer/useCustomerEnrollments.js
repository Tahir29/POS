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

  // invested_amount / total_payable don't exist on the real
  // SchemeEnrollment/List response, and scheme_status is a bare number
  // with no documented enum mapping — same findings as
  // useSchemeEnrollments.js (confirmed 2026-07-16). Deriving from
  // scheme_monthly_details instead, which is unambiguous.
  const monthlyDetails = entity.scheme_monthly_details ?? [];
  const investedFromMonths = monthlyDetails
    .filter((m) => m.payment_made)
    .reduce((sum, m) => sum + (Number(m.month_amount) || 0), 0);
  const hasPendingInstallment = monthlyDetails.length > 0
    ? monthlyDetails.some((m) => !m.payment_made)
    : true;

  return {
    enrollmentId:    get('scheme_enrollment_id'),
    schemeName:      get('scheme_display_name') ?? get('scheme_code'),
    schemeCode:      get('scheme_code'),
    hasPendingInstallment,
    enrolledDate:    get('document_date'),
    schemeAmount:    get('scheme_amount'),
    tenure:          get('tenure'),
    investedAmount:  get('invested_amount') ?? investedFromMonths,
    benifitAmount:   get('benifit_amount'),       // ⚠️ preserve API typo
    totalPayable:    get('total_amount') ?? get('total_payable'),
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