// src/hooks/catalog/useAllCatalog.js
// Fetches the complete product catalog for a given store in one request (Take: 0).
// All filtering, searching, sorting, and barcode lookup happen client-side —
// identical pattern to useAllOrders / useAllCustomers.
//
// Response shape (confirmed OrnaVerse pattern):
//   response.data.Entities[]  — array of catalog product objects

import { useQuery }    from '@tanstack/react-query';
import { useSelector } from 'react-redux';

import { QUERY_KEYS }   from '@/constants/queryKeys';
import APP_CONFIG       from '@/constants/appConfig';
import { getAllProducts } from '@/services/catalogService';

const selectIsAuthenticated = (state) => state.auth.isAuthenticated;

/**
 * @param {number|null} storeId - The store to scope the catalog to.
 *   Defaults to the Redux activeStoreId when not provided.
 *   Pass an explicit storeId to support the local catalog store switcher.
 */
export function useAllCatalog(storeId) {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  return useQuery({
    queryKey: QUERY_KEYS.CATALOG.ALL(storeId),
    queryFn:  () => getAllProducts(storeId),
    enabled:  isAuthenticated && !!storeId,
    staleTime: APP_CONFIG.STALE_TIME.STOCK,
    select: (response) => {
      const entities = response?.Entities;
      if (!Array.isArray(entities)) return [];
      return entities;
    },
  });
}