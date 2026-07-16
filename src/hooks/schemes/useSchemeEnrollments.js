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
  // invested_amount / total_payable don't exist on the real
  // SchemeEnrollment/List response (confirmed 2026-07-16) — invested must
  // be derived from scheme_monthly_details[] (sum of paid months), and the
  // real total field is `total_amount`, not `total_payable`.
  const monthlyDetails = raw.scheme_monthly_details ?? [];
  const investedFromMonths = monthlyDetails
    .filter((m) => m.payment_made)
    .reduce((sum, m) => sum + (Number(m.month_amount) || 0), 0);

  // `status` — NOT derived from raw.scheme_status. Confirmed 2026-07-16
  // that field is a bare number (0 or 1 seen on real, clearly-ongoing
  // enrollments) with no documented enum mapping anywhere in the API spec,
  // and the app previously compared it against the string 'active', which
  // never matched — silently hiding the Record Payment button on every
  // enrollment. Deriving status from scheme_monthly_details instead, which
  // is unambiguous: a month is either paid or it isn't.
  const hasPendingInstallment = monthlyDetails.length > 0
    ? monthlyDetails.some((m) => !m.payment_made)
    : true; // no monthly schedule loaded yet — don't block payment on that
  const isFullyPaid = monthlyDetails.length > 0 && !hasPendingInstallment;

  return {
    enrollmentId:      raw.scheme_enrollment_id,
    partyId:           raw.party_id,
    partyName:         raw.party_name   ?? '',
    mobile:            raw.mobile       ?? '',
    schemeId:          raw.scheme_id,
    schemeName:        raw.scheme_display_name ?? raw.scheme_code ?? '',
    schemeCode:        raw.scheme_code  ?? '',
    status:            isFullyPaid ? 'completed' : 'active',
    hasPendingInstallment,
    documentDate:      raw.document_date,
    schemeAmount:      raw.scheme_amount    ?? 0,
    tenure:            raw.tenure           ?? 0,
    investedAmount:    raw.invested_amount  ?? investedFromMonths,
    // ⚠ API typo — benifit_amount preserved exactly. Not present on active
    // enrollments (confirmed 2026-07-16) — likely only populated once
    // matured/foreclosed via GetSchemeMaturityBenefit/GetSchemeForcloseBenefit.
    benefitAmount:     raw.benifit_amount   ?? 0,
    totalPayable:      raw.total_amount ?? raw.total_payable ?? 0,
    maturityYear:      raw.maturity_year,
    maturityMonth:     raw.maturity_month,
    raw,
  };
}
