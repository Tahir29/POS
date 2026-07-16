// src/hooks/transactions/useItemMasterSearch.js
// SKU search across the master item catalogue (NOT stock-scoped) — used by
// Exchange/Buyback item pickers, where the item being handed in by the
// customer isn't necessarily in this store's live stock.

import { useQuery } from '@tanstack/react-query';
import { searchMasterItems } from '@/services/itemService';
import { QUERY_KEYS } from '@/constants/queryKeys';

export function useItemMasterSearch(query) {
  const trimmed = (query ?? '').trim();

  const result = useQuery({
    queryKey: QUERY_KEYS.ITEMS.MASTER_SEARCH(trimmed),
    queryFn:  async () => {
      const data = await searchMasterItems(trimmed);
      return data?.Entities ?? [];
    },
    enabled:   trimmed.length >= 2,
    staleTime: 0,
  });

  return {
    results:   result.data ?? [],
    isLoading: result.isLoading,
  };
}
