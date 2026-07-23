'use client';

import { Suspense } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

import KPICard              from '@/components/features/dashboard/KPICard';
import RecentOrdersList     from '@/components/features/dashboard/RecentOrdersList';
import QuickActionGrid      from '@/components/features/dashboard/QuickActions';
import TodaysActivityStrip  from '@/components/features/dashboard/TodaysActivityStrip';

import { useDashboardSummary } from '@/hooks/dashboard/useDashboardSummary';

function DashboardScreen() {
  const queryClient = useQueryClient();

  const {
    isLoading,
    todayRevenue,
    revenueTrendPct,
    todayOrderCount,
    ordersTrendDelta,
    revenueSparkline,
    recentOrders,
    pendingReturnsCount,
    activityToday,
  } = useDashboardSummary();

  // ── Manual refresh ────────────────────────────────────────────────────────
  // Invalidates orders, returns, exchange, and buyback queries — the four
  // data sources useDashboardSummary reads from. Each list re-fetches
  // independently in the background.
  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['orders'] }),
      queryClient.invalidateQueries({ queryKey: ['returns', 'list'] }),
      queryClient.invalidateQueries({ queryKey: ['exchange', 'list'] }),
      queryClient.invalidateQueries({ queryKey: ['buyback', 'list'] }),
    ]);
  };

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
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full px-4 md:px-6">

      {/* ── Manual refresh ─────────────────────────────────────── */}
      <div className="flex justify-end -mb-2">
        <button
          type="button"
          onClick={handleRefresh}
          aria-label="Refresh dashboard"
          className="flex items-center justify-center h-10 w-10 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </div>

      {/* ── ROW 1: KPI cards ───────────────────────────────────── */}
      {/* Scheme Collections intentionally omitted — no data source yet (Phase 23) */}
      {/* Only Today's Revenue carries the terracotta accent — keeps it a single signal */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KPICard
          label="Today's Revenue"
          value={`₹${todayRevenue.toLocaleString('en-IN')}`}
          trend={revenueTrend}
          sparkline={revenueSparkline}
          isLoading={isLoading}
          accent
        />
        <KPICard
          label="Orders Today"
          value={String(todayOrderCount)}
          trend={ordersTrend}
          isLoading={isLoading}
        />
        <KPICard
          label="Pending Returns"
          value={String(pendingReturnsCount)}
          trend={returnsTrend}
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
        isLoading={isLoading}
      />

    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Loading dashboard...</div>}>
      <DashboardScreen />
    </Suspense>
  );
}