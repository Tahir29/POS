// src/hooks/products/useVariantPricing.js
// Live price for a single item/variant via Services/Helpers/SetSalesItems.
//
// Called for EVERY item, not just item_rate === 0 ones. The stored item_rate
// is not a usable price — it understates the piece by 2-3x where it's set at
// all (see the PRICING note in catalogService.js) — and this hook's result is
// what becomes the cart's unitPrice, so anything else quotes one figure and
// bills another. See pricingService.js / apiEndpoints.js HELPERS block for
// the confirmed contract.
//
// MTO (Made-to-Order) GUARD — CustomizeSheet's mtoFallback is a pseudo-item
// built by spreading the BASE product and only swapping top-level
// karat_id/metal_color_id/item_size_id; its item_components[] BOM is still
// the base item's, so SetSalesItems has nothing genuine to price for the
// combo actually chosen. Two failure modes were both live before this guard:
//   1. Cache collision — the query key used to be itemId ONLY, identical to
//      the base product's own pricing query, so once the base price was
//      cached this "priced" the MTO combo by returning the base item's price
//      untouched — no network call, no recompute, no error.
//   2. Even on a cold cache, calculateItemRates([mtoFallback]) prices the
//      unmodified BOM, so it would likely still return the base SKU's own
//      figure regardless of the karat/metal actually selected.
// Either way: an operator could customize to a different karat/metal, get a
// non-null price, add it to cart, and bill the wrong amount with nothing on
// screen indicating anything was wrong. CustomizeSheet's own preview already
// refuses to price this case (`needsLivePricing = !!exactVariant`) — this
// hook now enforces the same rule centrally so no caller can miss it.

import { useQuery } from '@tanstack/react-query';
import { calculateItemRates } from '@/services/pricingService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {object|null} item — full item object (from Style/Retrieve's
 *   style_variants[] or Items/Retrieve), or null/undefined to disable.
 *   An MTO pseudo-variant (item._isMTO) is never priced — see above.
 */
export function useVariantPricing(item) {
  const isMTO = !!item?._isMTO;

  return useQuery({
    queryKey: QUERY_KEYS.ITEMS.PRICING(item?.item_id, item?.karat_id, item?.metal_color_id, item?.item_size_id),
    queryFn: async () => {
      const [priced] = await calculateItemRates([item]);
      return priced ?? null;
    },
    enabled: !!item?.item_id && !isMTO,
    // Metal rates are typically set once a day (see settingsService's
    // addMetalRate) but can change same-day — STOCK's short window matches
    // that "live, don't cache long" expectation.
    staleTime: APP_CONFIG.STALE_TIME.STOCK,
  });
}
