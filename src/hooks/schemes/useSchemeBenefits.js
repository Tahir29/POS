// On-demand maturity / foreclose / cancellation calculations for one
// enrollment. Read-only calculators (they don't close anything); modelled as
// a mutation since staff trigger them deliberately, one at a time. The
// endpoints need the full enrollment (including scheme_monthly_details), not
// just an id — see services/schemeService.js.

import { useState, useCallback } from 'react';
import {
  getSchemeEnrollmentDetail,
  getSchemeMaturityBenefit,
  getSchemeForcloseBenefit,
  getSchemeCancellation,
  canMatureEnrollment,
  canForecloseEnrollment,
  getSchemeRules,
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
      // Always re-fetch: the calculation is only as good as the current
      // month rows, and an instalment may have been recorded moments ago.
      const enrollment = await getSchemeEnrollmentDetail(enrollmentId);
      if (!enrollment) throw new Error('Could not load this enrollment.');

      if (which === 'maturity') {
        const { allowed, remaining } = canMatureEnrollment(enrollment);
        if (!allowed) {
          // Mirrors OrnaVerse's own gate, so staff get a sentence instead of
          // a server error.
          throw new Error(
            `Maturity needs every instalment paid — ${remaining} still outstanding.`,
          );
        }
      }

      if (which === 'foreclose') {
        // Per-scheme rule, not a fixed constant — see
        // canForecloseEnrollment's own comment for why this needs a
        // separate fetch keyed on THIS enrollment's scheme_id.
        const schemeRules = await getSchemeRules(enrollment.scheme_id);
        const { allowed, paid, required } = canForecloseEnrollment(enrollment, schemeRules);
        if (!allowed) {
          // Mirrors OrnaVerse's own gate (confirmed live — see
          // canForecloseEnrollment's own comment), so staff get a sentence
          // instead of getting this far and only then discovering the rule.
          throw new Error(
            `Foreclosure needs at least ${required} instalments paid — only ${paid} so far.`,
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
