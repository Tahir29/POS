// src/hooks/schemes/useSchemeBenefits.js
// On-demand maturity / foreclose / cancellation calculations for one
// enrollment.
//
// These are READ-ONLY calculators — they work out what a customer would get,
// they don't close anything. Modelled as a mutation rather than a query
// because staff trigger them deliberately, one at a time, and re-running is
// meaningful.
//
// The endpoints need the FULL enrollment (including every scheme_monthly_details
// row), not an id — see services/schemeService.js for the captured shape.

import { useState, useCallback } from 'react';
import {
  getSchemeEnrollmentDetail,
  getSchemeMaturityBenefit,
  getSchemeForcloseBenefit,
  getSchemeCancellation,
  canMatureEnrollment,
} from '@/services/schemeService';

const CALCULATORS = {
  maturity:     getSchemeMaturityBenefit,
  foreclose:    getSchemeForcloseBenefit,
  cancellation: getSchemeCancellation,
};

/**
 * @param {number|null} enrollmentId
 */
export function useSchemeBenefits(enrollmentId) {
  const [kind,      setKind]      = useState(null);   // which one is running/ran
  const [result,    setResult]    = useState(null);
  const [error,     setError]     = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const reset = useCallback(() => {
    setKind(null); setResult(null); setError(null);
  }, []);

  /**
   * @param {'maturity'|'foreclose'|'cancellation'} which
   */
  const calculate = useCallback(async (which) => {
    if (!enrollmentId) return;
    const fn = CALCULATORS[which];
    if (!fn) return;

    setKind(which); setResult(null); setError(null); setIsLoading(true);
    try {
      // Always re-fetch: an instalment may have been recorded moments ago,
      // and the calculation is only as good as the month rows it's given.
      const enrollment = await getSchemeEnrollmentDetail(enrollmentId);
      if (!enrollment) throw new Error('Could not load this enrollment.');

      if (which === 'maturity') {
        const { allowed, remaining } = canMatureEnrollment(enrollment);
        if (!allowed) {
          // Mirrors OrnaVerse's own gate, so staff get a sentence instead of
          // a 500 from an unguarded server path.
          throw new Error(
            `Maturity needs every instalment paid — ${remaining} still outstanding.`,
          );
        }
      }

      setResult(await fn(enrollment));
    } catch (e) {
      setError(e?.message || 'Could not calculate. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [enrollmentId]);

  return { calculate, reset, kind, result, error, isLoading };
}
