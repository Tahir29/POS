// Live price for a single item/variant — THE figure the customer is quoted.
// Called for every item, never the stored item_rate (unreliable — see the
// PRICING note in catalogService.js). This result becomes the cart's
// unitPrice, so it must match what checkout collects: priceItemAsSold prices
// the physical piece when the shelf has one, the master only for
// made-to-order, keeping the two paths consistent.

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
    // Metal rates can change same-day — STOCK's short window keeps this live.
    staleTime: APP_CONFIG.STALE_TIME.STOCK,
  });
}
