// Live price for a single item/variant — THE figure the customer is quoted.
//
// Called for EVERY item, not just item_rate === 0 ones. The stored item_rate
// is not a usable price — it understates the piece by 2-3x where it's set at
// all (see the PRICING note in catalogService.js).
//
// This result becomes the cart's unitPrice, which is persisted in Redux and
// shown in the mini cart, so it MUST be the same number checkout collects.
// It used to price the item master while checkout priced the physical piece,
// which is exactly how the same bracelet came to read ₹30,877.20 in the mini
// cart and ₹23,507.56 at checkout. priceItemAsSold closes that: the piece
// when the shelf has one, the master only for made-to-order.

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { priceItemAsSold } from '@/services/pricingService';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {object|null} item — full item object (from Style/Retrieve's
 *   style_variants[] or Items/Retrieve), or null/undefined to disable.
 */
export function useVariantPricing(item) {
  const activeStoreId = useSelector(selectActiveStoreId);

  return useQuery({
    queryKey: QUERY_KEYS.ITEMS.PRICING(item?.item_id, activeStoreId),
    queryFn: () => priceItemAsSold({ item, companyId: activeStoreId }),
    enabled: !!item?.item_id,
    // Metal rates are typically set once a day (see settingsService's
    // addMetalRate) but can change same-day — STOCK's short window matches
    // that "live, don't cache long" expectation.
    staleTime: APP_CONFIG.STALE_TIME.STOCK,
  });
}
