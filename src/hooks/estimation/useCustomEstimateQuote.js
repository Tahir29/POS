// On-demand pricing for a Custom Estimate — see customEstimationService.js
// for what "custom estimate" means and why Save isn't wired yet.
//
// Modelled as calculate-on-demand (useState, not a TanStack Query hook) —
// staff type a weight and explicitly ask "price this"; a query firing on
// every keystroke would be the wrong trigger. Same reasoning, same shape,
// as useSchemeBenefits.js.

import { useState, useCallback } from 'react';
import { calculateItemRates } from '@/services/pricingService';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @returns {{
 *   quote: (item: object, weight: number) => Promise<void>,
 *   reset: () => void,
 *   result: object|null,  // priced item — item_rate/sub_total/tax_amount/net_amount
 *   error: string|null,
 *   isLoading: boolean,
 * }}
 */
export function useCustomEstimateQuote() {
  const [result,    setResult]    = useState(null);
  const [error,     setError]     = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const reset = useCallback(() => {
    setResult(null); setError(null);
  }, []);

  const quote = useCallback(async (item, weight) => {
    if (!item) return;
    if (!(weight > 0)) {
      setError('Enter a weight greater than 0.');
      setResult(null);
      return;
    }

    setIsLoading(true); setError(null); setResult(null);
    try {
      // Re-weigh the template's own BOM component(s) to the customer's
      // requested weight — confirmed live that Items/List rows already
      // carry the full item_components[] (same shape as Items/Retrieve),
      // so no extra fetch is needed here. purity is per-component (a
      // multi-metal BOM could exist even though today's one custom item
      // has just one), so each component scales independently rather than
      // assuming a single flat purity for the whole item.
      const reweighed = {
        ...item,
        weight,
        net_weight: weight,
        item_components: (item.item_components ?? []).map((c) => ({
          ...c,
          weight,
          pure_weight: +(weight * c.purity).toFixed(3),
        })),
      };

      const [priced] = await calculateItemRates([reweighed], APP_CONFIG.DOCUMENT_TYPES.ESTIMATION);
      if (!priced) throw new Error('No price came back for this weight.');
      setResult(priced);
    } catch (e) {
      setError(e?.response?.data?.Message ?? e?.message ?? 'Could not calculate. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { quote, reset, result, error, isLoading };
}