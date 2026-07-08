// src/hooks/dashboard/useDashboardSummary.js
//
// Aggregates real, already-fetched data for the redesigned dashboard:
//   - Today's Revenue / Orders Today KPI cards (+ vs-yesterday trend)
//   - A 7-day revenue sparkline (derived from the same order list — no
//     extra network call)
//   - Recent Orders (top 4, most recent first)
//   - Pending Returns count
//   - Today's Activity counts (Returns / Exchange / Buyback)
//
// NOTE: Scheme Collections and a "Schemes" activity count are intentionally
// NOT included here — there is no SchemeReceipt/List endpoint wired up yet
// (Phase 23, still queued). Do not fabricate that data; add it here once
// Phase 23 lands.
//
// Piggybacks entirely on hooks that already exist elsewhere in the app
// (useAllOrders, useReturns, useExchanges, useBuybacks) so this adds zero
// new network calls beyond what those pages already trigger.

import { useMemo } from 'react';
import { useAllOrders } from '@/hooks/orders/useAllOrders';
import { useReturns }   from '@/hooks/returns/useReturns';
import { useExchanges } from '@/hooks/exchange/useExchanges';
import { useBuybacks }  from '@/hooks/buyback/useBuybacks';

// Large-enough page size to approximate "all records for today" for the
// summary widgets, consistent with the useAll* full-fetch pattern used
// elsewhere (Take:300-style) rather than the default 50-row page.
const SUMMARY_PAGE_SIZE = 300;

// ── Date helpers ──────────────────────────────────────────────
// Mirrors the LOCAL-date comparison approach in useOrdersSummary so
// "today" and "yesterday" are computed consistently across the app.

function toLocalPrefix(date) {
  const yyyy = date.getFullYear();
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const dd   = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getLocalDatePrefix(isoString) {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return null;
  return toLocalPrefix(d);
}

function daysAgoPrefix(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toLocalPrefix(d);
}

/**
 * @returns {{
 *   isLoading: boolean,
 *   isError: boolean,
 *   todayRevenue: number,
 *   revenueTrendPct: number|null,
 *   todayOrderCount: number,
 *   ordersTrendDelta: number,
 *   revenueSparkline: number[],
 *   recentOrders: Array,
 *   pendingReturnsCount: number,
 *   activityToday: { returns: number, exchanges: number, buybacks: number },
 * }}
 */
export function useDashboardSummary() {
  const { allOrders, isLoading: ordersLoading, isError: ordersError } = useAllOrders();
  const { returns,   isLoading: returnsLoading,   isError: returnsError }   = useReturns({ page: 1, pageSize: SUMMARY_PAGE_SIZE });
  const { exchanges, isLoading: exchangesLoading, isError: exchangesError } = useExchanges({ page: 1, pageSize: SUMMARY_PAGE_SIZE });
  const { buybacks,  isLoading: buybacksLoading,  isError: buybacksError }  = useBuybacks({ page: 1, pageSize: SUMMARY_PAGE_SIZE });

  const isLoading = ordersLoading || returnsLoading || exchangesLoading || buybacksLoading;
  const isError   = ordersError || returnsError || exchangesError || buybacksError;

  return useMemo(() => {
    const todayPrefix     = toLocalPrefix(new Date());
    const yesterdayPrefix = daysAgoPrefix(1);

    // ── Today vs yesterday — orders & revenue ────────────────────
    let todayRevenue = 0;
    let todayOrderCount = 0;
    let yesterdayRevenue = 0;
    let yesterdayOrderCount = 0;

    for (const order of allOrders) {
      if (!order.orderDate) continue;
      const prefix = getLocalDatePrefix(order.orderDate);
      const amount = order.totalAmount ?? 0;

      if (prefix === todayPrefix) {
        todayRevenue += amount;
        todayOrderCount += 1;
      } else if (prefix === yesterdayPrefix) {
        yesterdayRevenue += amount;
        yesterdayOrderCount += 1;
      }
    }

    const revenueTrendPct = yesterdayRevenue > 0
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
      : null; // no baseline — avoid a misleading percentage

    const ordersTrendDelta = todayOrderCount - yesterdayOrderCount;

    // ── 7-day revenue sparkline (oldest → newest, includes today) ──
    const dayBuckets = new Map();
    for (let i = 6; i >= 0; i--) {
      dayBuckets.set(daysAgoPrefix(i), 0);
    }
    for (const order of allOrders) {
      if (!order.orderDate) continue;
      const prefix = getLocalDatePrefix(order.orderDate);
      if (dayBuckets.has(prefix)) {
        dayBuckets.set(prefix, dayBuckets.get(prefix) + (order.totalAmount ?? 0));
      }
    }
    const revenueSparkline = Array.from(dayBuckets.values());

    // ── Recent Orders (top 4, most recent first) ────────────────
    const recentOrders = [...allOrders]
      .filter((o) => !!o.orderDate)
      .sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate))
      .slice(0, 4);

    // ── Pending Returns ──────────────────────────────────────────
    const pendingReturnsCount = returns.filter((r) => r.status === 'pending').length;

    // ── Today's Activity ─────────────────────────────────────────
    const countToday = (list) =>
      list.filter((item) => item.documentDate && getLocalDatePrefix(item.documentDate) === todayPrefix).length;

    const activityToday = {
      returns:   countToday(returns),
      exchanges: countToday(exchanges),
      buybacks:  countToday(buybacks),
    };

    return {
      isLoading,
      isError,
      todayRevenue,
      revenueTrendPct,
      todayOrderCount,
      ordersTrendDelta,
      revenueSparkline,
      recentOrders,
      pendingReturnsCount,
      activityToday,
    };
  }, [allOrders, returns, exchanges, buybacks, isLoading, isError]);
}