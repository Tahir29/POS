// src/hooks/products/useProductAttributes.js

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';
import { getItemAttributes } from '@/services/itemService';

/**
 * Fetches product attributes by attribute type ID.
 * Stale time: 30 minutes (static master data).
 * @param {number} attributeTypeId
 */
export function useProductAttributes(attributeTypeId) {
  return useQuery({
    queryKey:  QUERY_KEYS.ITEMS.ATTRIBUTES(attributeTypeId),
    queryFn:   () => getItemAttributes(attributeTypeId),
    enabled:   !!attributeTypeId,
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
    select:    (data) => data?.data ?? data?.Entities ?? data?.result ?? [],
  });
}