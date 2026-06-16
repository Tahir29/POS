// src/hooks/orders/useOrdersSummary.js
// Derives today's order count for the DashboardOrderCount widget.
//
// Piggybacks on useAllOrders (Take: 0, same query key) so no extra
// network call is made — the full orders list is already fetched and
// cached by the /orders page. If the cache is cold (dashboard loaded
// first), useAllOrders fetches it once and both consumers share the
// result.
//
// "Today" is compared using the LOCAL date of each order's document_date
// (not the raw UTC ISO prefix) so IST orders near midnight are counted
// correctly. staleTime comes from STALE_TIME.ORDERS (2 min) via
// useAllOrders.

import { useMemo } from 'react';
import { useAllOrders } from '@/hooks/orders/useAllOrders';

function getTodayPrefix() {
  // Returns "YYYY-MM-DD" in LOCAL time
  const d    = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getLocalDatePrefix(isoString) {
  // Parses an ISO date string and returns its LOCAL "YYYY-MM-DD"
  // so that UTC-vs-IST offset is handled correctly.
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * @returns {{
 *   data: { todayCount: number } | null,
 *   isLoading: boolean,
 *   isFetching: boolean,
 *   isError: boolean,
 *   refetch: () => void,
 * }}
 */
export function useOrdersSummary() {
  const { allOrders, isLoading, isFetching, isError, refetch } = useAllOrders();

  const todayCount = useMemo(() => {
    const todayPrefix = getTodayPrefix();
    return allOrders.filter((order) => {
      if (!order.orderDate) return false;
      return getLocalDatePrefix(order.orderDate) === todayPrefix;
    }).length;
  }, [allOrders]);

  return {
    data:       isLoading ? null : { todayCount },
    isLoading,
    isFetching,
    isError,
    refetch:    refetch ?? (() => {}),
  };
}