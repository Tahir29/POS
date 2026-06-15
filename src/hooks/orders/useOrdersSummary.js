import { useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';
import { getOrders } from '@/services/orderService';
import { useActiveStore } from '@/hooks/store/useActiveStore';

/**
 * Fetches POS orders and derives today's order count client-side.
 * OrnaVerse has no dedicated "today's orders" endpoint — we fetch the
 * recent orders list and filter by today's date in the select transform.
 *
 * Returns the full query result. Consuming components access:
 *   data.allOrders   — full orders array
 *   data.todayCount  — number of orders placed today
 *
 * @returns {import('@tanstack/react-query').UseQueryResult} TanStack Query result object.
 */
export function useOrdersSummary() {
  const { activeStoreId } = useActiveStore();

  return useQuery({
    queryKey: QUERY_KEYS.ORDERS.LIST({ storeId: activeStoreId }),
    queryFn: () => getOrders({ take: APP_CONFIG.PAGINATION.ORDERS_TAKE, skip: 0 }),
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
    enabled: !!activeStoreId,
    select: (data) => {
      const allOrders = data?.data ?? [];

      // Derive today's date string in YYYY-MM-DD format using local time.
      // OrnaVerse order_date is compared by string prefix match so timezone
      // differences on the server do not cause false negatives.
      // Once the exact date field name is confirmed in UAT, tighten this
      // to a single field reference.
      const todayPrefix = new Date().toISOString().slice(0, 10);

      const todayCount = allOrders.filter((order) => {
        const dateValue = order.order_date ?? order.created_at ?? '';
        return String(dateValue).startsWith(todayPrefix);
      }).length;

      return { allOrders, todayCount };
    },
  });
}
