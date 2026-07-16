// src/hooks/checkout/useActivePromotions.js
// Currently-usable promotions for the checkout promo-code picker.
// Filters the full Promotion/List result down to ones that are approved,
// not disabled, and within their date range today.

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';
import { listPromotions } from '@/services/promotionService';
import { isPromotionActive } from '@/lib/normalizers/promotion';

export function useActivePromotions() {
  return useQuery({
    queryKey:  QUERY_KEYS.CRM.PROMOTION_LIST(),
    queryFn:   listPromotions,
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
    select: (response) => {
      const entities = response?.data?.Entities ?? [];
      return entities.filter(isPromotionActive);
    },
  });
}
