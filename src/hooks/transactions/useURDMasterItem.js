// src/hooks/transactions/useURDMasterItem.js
// Fetches the generic "URD GOLD" master item's live data (current
// item_rate) via Items/Retrieve — see appConfig.js URD_MASTER_ITEMS for why
// this can't be found through search/list.

import { useQuery } from '@tanstack/react-query';
import { getItemDetail } from '@/services/itemService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

export function useURDMasterItem(metal = 'GOLD') {
  const itemId = APP_CONFIG.URD_MASTER_ITEMS[metal] ?? null;

  const query = useQuery({
    queryKey: QUERY_KEYS.ITEMS.DETAIL(itemId),
    queryFn:  async () => {
      const response = await getItemDetail(itemId);
      return response.data?.Entity ?? null;
    },
    enabled:   !!itemId,
    staleTime: APP_CONFIG.STALE_TIME.STOCK,
  });

  return {
    item:      query.data ?? null,
    isLoading: query.isLoading,
    isError:   query.isError,
  };
}
