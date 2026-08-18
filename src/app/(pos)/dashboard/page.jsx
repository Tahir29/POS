'use client';

import { Suspense } from 'react';
import { RevenueIcon, OrdersIcon, PendingReturnsIcon } from '@/components/features/dashboard/KPICard/icons';

import KPICard              from '@/components/features/dashboard/KPICard';
import RecentOrdersList     from '@/components/features/dashboard/RecentOrdersList';
import QuickActionGrid      from '@/components/features/dashboard/QuickActions';
import TodaysActivityStrip  from '@/components/features/dashboard/TodaysActivityStrip';
import InlineLoader         from '@/components/shared/InlineLoader';
import ErrorState           from '@/components/shared/ErrorState';

import { useDashboardSummary } from '@/hooks/dashboard/useDashboardSummary';

function DashboardScreen() {
  const {
    isLoading,
    isError,
    refetch,
    todayRevenue,
    revenueTrendPct,
    todayOrderCount,
    ordersTrendDelta,
    revenueSparkline,
    recentOrders,
    pendingReturnsCount,
    activityToday,
  } = useDashboardSummary();

  // A failed summary must not render as "nothing happened today" — every
  // KPI/list below is real-zero-shaped, so a backend outage and an idle
  // store would otherwise be indistinguishable to staff. Loading takes
  // priority (isError can be stale-true from a prior failed fetch while a
  // fresh one is already in flight).
  if (isError && !isLoading) {
    return (
      <div className="max-w-6xl mx-auto w-full px-4 py-4 md:px-6">
        <ErrorState
          title="Couldn't load today's activity."
          description="Today's revenue, orders, and activity counts couldn't be fetched. Quick actions below still work normally."
          onRetry={refetch}
        />
        <div className="mt-6">
          <QuickActionGrid />
        </div>
      </div>
    );
  }

  const revenueTrend = revenueTrendPct == null
    ? undefined
    : {
        type: revenueTrendPct >= 0 ? 'up' : 'down',
        text: `${revenueTrendPct >= 0 ? '+' : ''}${revenueTrendPct.toFixed(1)}% vs yesterday`,
      };

  const ordersTrend = {
    type: ordersTrendDelta > 0 ? 'up' : ordersTrendDelta < 0 ? 'down' : 'neutral',
    text: ordersTrendDelta === 0
      ? 'Same as yesterday'
      : `${ordersTrendDelta > 0 ? '+' : ''}${ordersTrendDelta} from yesterday`,
  };

  const returnsTrend = {
    type: pendingReturnsCount > 0 ? 'warning' : 'neutral',
    text: pendingReturnsCount > 0 ? 'needs attention' : 'all clear',
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full px-4 py-4 md:px-6">

      {/* ── ROW 1: KPI cards ───────────────────────────────────── */}
      {/* Scheme Collections intentionally omitted — no data source yet (Phase 23) */}
      {/* Only Today's Revenue carries the terracotta accent — keeps it a single signal */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KPICard
          label="Today's Revenue"
          value={`₹${todayRevenue.toLocaleString('en-IN')}`}
          trend={revenueTrend}
          sparkline={revenueSparkline}
          icon={RevenueIcon}
          isLoading={isLoading}
          accent
        />
        <KPICard
          label="Orders Today"
          value={String(todayOrderCount)}
          trend={ordersTrend}
          icon={OrdersIcon}
          isLoading={isLoading}
        />
        <KPICard
          label="Pending Returns"
          value={String(pendingReturnsCount)}
          trend={returnsTrend}
          icon={PendingReturnsIcon}
          isLoading={isLoading}
        />
      </div>

      {/* ── ROW 2: Recent orders + Quick actions ──────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentOrdersList orders={recentOrders} isLoading={isLoading} />
        </div>
        <div className="lg:col-span-1">
          <QuickActionGrid />
        </div>
      </div>

      {/* ── ROW 3: Today's activity ────────────────────────────── */}
      {/* Metal Rates card intentionally omitted — no read hook exists yet */}
      <TodaysActivityStrip
        returns={activityToday.returns}
        exchanges={activityToday.exchanges}
        buybacks={activityToday.buybacks}
        urdPurchases={activityToday.urdPurchases}
        isLoading={isLoading}
      />

    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<InlineLoader className="py-16" label="Loading dashboard…" />}>
      <DashboardScreen />
    </Suspense>
  );
}
