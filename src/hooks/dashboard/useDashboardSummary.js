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
// PHASE 22.5 UPDATE: migrated off the deleted hooks/returns, hooks/exchange,
// hooks/buyback (per-module) hooks onto the consolidated
// hooks/transactions/useTransactionLists.js hooks, which back the single
// /transactions page. Two shape differences from the old hooks, handled below:
//   1. New hooks take { skip, enabled } (fixed page size from APP_CONFIG),
//      not { page, pageSize } — page size here is the default (50 rows),
//      not the old SUMMARY_PAGE_SIZE of 300. Fine for a "today" widget in a
//      single store; revisit if a store does >50 returns/exchanges/buybacks
//      in one day.
//   2. New hooks return raw normalizeTransaction rows (no precomputed
//      `.status`) — pending-return detection is derived here from
//      raw.balance_amount / raw.receipt_amount, matching the same logic the
//      old normalizeReturn used to do inline.

import { useMemo } from 'react';
import { useAllOrders } from '@/hooks/orders/useAllOrders';
import { useReturns, useExchanges, useBuybacks } from '@/hooks/transactions/useTransactionLists';

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

// A return is "pending" when nothing has been refunded back yet.
function isPendingReturn(item) {
  const balance = item.raw?.balance_amount ?? 0;
  const receipt = item.raw?.receipt_amount ?? 0;
  return !(balance <= 0 && receipt > 0) && receipt === 0;
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
  const { items: returns,   isLoading: returnsLoading,   isError: returnsError }   = useReturns({ skip: 0 });
  const { items: exchanges, isLoading: exchangesLoading, isError: exchangesError } = useExchanges({ skip: 0 });
  const { items: buybacks,  isLoading: buybacksLoading,  isError: buybacksError }  = useBuybacks({ skip: 0 });

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
    const pendingReturnsCount = returns.filter(isPendingReturn).length;

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
