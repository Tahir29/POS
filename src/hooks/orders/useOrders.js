// Paginated sales list — (pos)/orders page. Paginates client-side over the
// same merged Orders+Invoices dataset as useAllOrders (identical query key,
// so the two hooks share one network round trip when mounted together, as
// orders/page.jsx does) — true server-side pagination isn't possible since
// Order/List and Invoice/List are independently-paginated endpoints whose
// pages can't be sliced and concatenated without desyncing chronological
// order. See useAllOrders.js for why both document types are included.

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
