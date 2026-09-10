// Lightweight lookup of just external_product_id (Shopify) for a style,
// used by the catalog grid to resolve which cards can show a Nector rating.
// Reuses useDesignVariants' exact queryKey + queryFn (Style/Retrieve) with a
// lighter `select`, so it shares that hook's cache entry instead of firing a
// second network call for the same endpoint.

import { useQuery } from '@tanstack/react-query';
import { getDesignVariants } from '@/services/itemService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

export function useStyleExternalProductId(styleId) {
  const query = useQuery({
    queryKey:  QUERY_KEYS.ITEMS.DESIGN_VARIANTS(styleId),
    queryFn:   () => getDesignVariants(styleId),
    enabled:   !!styleId,
    staleTime: APP_CONFIG.STALE_TIME.CATALOG,
    select:    (response) => response?.data?.Entity?.external_product_id ?? null,
  });

  return {
    externalProductId: query.data ?? null,
    isLoading: query.isLoading,
  };
}
