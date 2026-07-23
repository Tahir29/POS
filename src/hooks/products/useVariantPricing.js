// src/hooks/products/useVariantPricing.js
// Live price for a single item/variant via Services/Helpers/SetSalesItems
// — only needed when the item's own item_rate is 0 (BOM-priced items whose
// real sell price floats with today's metal rate rather than being stored
// statically). See pricingService.js / apiEndpoints.js HELPERS block for
// the confirmed contract.

import { useQuery } from '@tanstack/react-query';
import { calculateItemRates } from '@/services/pricingService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {object|null} item — full item object (from Style/Retrieve's
 *   style_variants[] or Items/Retrieve), or null/undefined to disable.
 */
export function useVariantPricing(item) {
  return useQuery({
    queryKey: QUERY_KEYS.ITEMS.PRICING(item?.item_id),
    queryFn: async () => {
      const [priced] = await calculateItemRates([item]);
      return priced ?? null;
    },
    enabled: !!item?.item_id,
    // Metal rates are typically set once a day (see settingsService's
    // addMetalRate) but can change same-day — STOCK's short window matches
    // that "live, don't cache long" expectation.
    staleTime: APP_CONFIG.STALE_TIME.STOCK,
  });
}
