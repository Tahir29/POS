// Paginated sales list — (pos)/orders page.
//
// Paginates CLIENT-SIDE over the same merged Orders+Invoices dataset as
// useAllOrders (identical query key, so the two hooks share one network
// round trip when mounted together, as orders/page.jsx does). True
// server-side pagination isn't possible here: Order/List and Invoice/List
// are two independently-paginated endpoints, and slicing each separately
// then concatenating would desync page boundaries from chronological order.
// See useAllOrders.js for why both document types are included.

import { useMemo } from 'react';
import { useAllOrders } from '@/hooks/orders/useAllOrders';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {{ skip?: number }} [options]
 */
export function useOrders({ skip = 0 } = {}) {
  const take = APP_CONFIG.PAGINATION.ORDERS_TAKE;
  const { allOrders, isLoading, isFetching, isError, refetch } = useAllOrders();

  const orders = useMemo(
    () => allOrders.slice(skip, skip + take),
    [allOrders, skip, take]
  );

  return {
    orders,
    totalCount: allOrders.length,
    take,
    isLoading,
    isFetching,
    isError,
    refetch,
  };
}
