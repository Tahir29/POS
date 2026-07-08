// src/hooks/schemes/useSchemeEnrollments.js
// Fetch scheme enrollments — optionally filtered by customer.
//
// NOTE: SchemeEnrollment/List returns a BARE ARRAY on UAT (no Entities wrapper).
// The select function handles both shapes defensively.

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getSchemeEnrollments } from '@/services/schemeService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import { selectActiveStoreId } from '@/store/slices/storeSlice';

export function useSchemeEnrollments({ partyId } = {}) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const storeId         = useSelector(selectActiveStoreId);

  const params = { storeId, partyId };

  return useQuery({
    queryKey: partyId
      ? QUERY_KEYS.SCHEMES.CUSTOMER_ENROLLMENTS(partyId)
      : QUERY_KEYS.SCHEMES.ENROLLMENTS(params),

    queryFn: () => getSchemeEnrollments({
      take:       0,
      party_id:   partyId,
      company_id: storeId,
    }),

    enabled:   !!isAuthenticated && !!storeId,
    staleTime: 5 * 60 * 1000,

    select: (data) => {
      // UAT returns a bare array; production may wrap in { Entities[] }
      const raw = Array.isArray(data) ? data : (data?.Entities ?? []);
      return raw.map(normalizeEnrollment);
    },
  });
}

function normalizeEnrollment(raw) {
  return {
    enrollmentId:      raw.scheme_enrollment_id,
    partyId:           raw.party_id,
    partyName:         raw.party_name   ?? '',
    mobile:            raw.mobile       ?? '',
    schemeId:          raw.scheme_id,
    schemeName:        raw.scheme_display_name ?? raw.scheme_code ?? '',
    schemeCode:        raw.scheme_code  ?? '',
    status:            raw.scheme_status ?? 'active',
    documentDate:      raw.document_date,
    schemeAmount:      raw.scheme_amount    ?? 0,
    tenure:            raw.tenure           ?? 0,
    investedAmount:    raw.invested_amount  ?? 0,
    // ⚠ API typo — benifit_amount preserved exactly
    benefitAmount:     raw.benifit_amount   ?? 0,
    totalPayable:      raw.total_payable    ?? 0,
    maturityYear:      raw.maturity_year,
    maturityMonth:     raw.maturity_month,
    raw,
  };
}
