// Fetch scheme enrollments — optionally filtered by customer.
// SchemeEnrollment/List returns a bare array on UAT (no Entities wrapper);
// `select` below handles both shapes defensively.

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
    // Both branches include storeId in the key (the network call always
    // sends company_id) so switching stores with a customer selected
    // refetches instead of serving stale enrollments from another store.
    queryKey: partyId
      ? QUERY_KEYS.SCHEMES.CUSTOMER_ENROLLMENTS(partyId, storeId)
      : QUERY_KEYS.SCHEMES.ENROLLMENTS(params),

    queryFn: () => getSchemeEnrollments({
      take:       0,
      party_id:   partyId,
      company_id: storeId,
    }),

    enabled:   !!isAuthenticated && !!storeId,
    staleTime: 5 * 60 * 1000,

    select: (data) => {
      const raw = Array.isArray(data) ? data : (data?.Entities ?? []);
      return raw.map(normalizeEnrollment);
    },
  });
}

function normalizeEnrollment(raw) {
  // invested_amount / total_payable don't exist on the real
  // SchemeEnrollment/List response — invested is derived from
  // scheme_monthly_details[] (sum of paid months); the real total field is
  // `total_amount`, not `total_payable`.
  const monthlyDetails = raw.scheme_monthly_details ?? [];
  const investedFromMonths = monthlyDetails
    .filter((m) => m.payment_made)
    .reduce((sum, m) => sum + (Number(m.month_amount) || 0), 0);

  // `status` was previously derived ONLY from scheme_monthly_details,
  // deliberately ignoring raw.scheme_status as "a bare number with no
  // documented enum mapping" — a month being paid or not is unambiguous,
  // an opaque enum wasn't. CONFIRMED LIVE 2026-09-18 (captured OrnaVerse's
  // own real client actions, full lifecycle): scheme_status:0 = Cancelled,
  // :2 = Matured (after Calculate Maturity → Mature, once all instalments
  // are paid — badge read stale "Active" until refreshed, a client-side
  // staleness quirk on OrnaVerse's own end, not evidence of a different
  // value), :3 = Redeemed (a SEPARATE subsequent action from Mature — its
  // own real Update payload carried every other field, including
  // benifit_amount, over unchanged from the Matured step, only
  // scheme_status itself moved 2→3). All three checked before the
  // installment-based heuristic, since none of their paid-ratios say
  // anything about real lifecycle state on their own. Foreclosure's own
  // status value remains unconfirmed (see schemeService.js's
  // closeSchemeEnrollment) — a foreclosed enrollment still falls through
  // to the installment-based heuristic below until that's captured the
  // same way.
  const isCancelled = raw.scheme_status === 0;
  const isMatured   = raw.scheme_status === 2;
  const isRedeemed  = raw.scheme_status === 3;
  const hasPendingInstallment = monthlyDetails.length > 0
    ? monthlyDetails.some((m) => !m.payment_made)
    : true; // no monthly schedule loaded yet — don't block payment on that
  const isFullyPaid = monthlyDetails.length > 0 && !hasPendingInstallment;

  return {
    enrollmentId:      raw.scheme_enrollment_id,
    partyId:           raw.party_id,
    partyName:         raw.party_name   ?? '',
    mobile:            raw.mobile       ?? '',
    email:             raw.email        ?? '',
    schemeId:          raw.scheme_id,
    schemeName:        raw.scheme_display_name ?? raw.scheme_code ?? '',
    schemeCode:        raw.scheme_code  ?? '',
    // Surfaced so buildSchemeReceiptPayload() can pass these through to
    // SchemeReceipt/Create.
    schemeType:        raw.scheme_type,
    schemeUniqueCode:  raw.scheme_unique_code ?? '',
    status:            isCancelled ? 'cancelled' : isRedeemed ? 'redeemed' : isMatured ? 'matured' : (isFullyPaid ? 'completed' : 'active'),
    hasPendingInstallment,
    documentDate:      raw.document_date,
    schemeAmount:      raw.scheme_amount    ?? 0,
    tenure:            raw.tenure           ?? 0,
    investedAmount:    raw.invested_amount  ?? investedFromMonths,
    // API typo — benifit_amount preserved exactly as the server sends it.
    // Only populated once matured/foreclosed.
    benefitAmount:     raw.benifit_amount   ?? 0,
    totalPayable:      raw.total_amount ?? raw.total_payable ?? 0,
    maturityYear:      raw.maturity_year,
    maturityMonth:     raw.maturity_month,
    raw,
  };
}
