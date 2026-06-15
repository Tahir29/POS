'use client';

import { useRouter } from 'next/navigation';
import { ClipboardList, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrdersSummary } from '@/hooks/orders/useOrdersSummary';

// ── COMPONENT ─────────────────────────────────────────────────

/**
 * DashboardOrderCount
 *
 * Displays today's order count as a tappable summary widget.
 * Tapping navigates to /orders so the associate can drill in.
 *
 * State matrix:
 *   isLoading  → animated pulse skeleton
 *   isError    → error indicator (non-blocking — widget degrades gracefully)
 *   !enabled   → disabled state (no active store yet)
 *   data       → count badge + label
 *
 * Data source: useOrdersSummary → data.todayCount
 * The hook fetches POS/Order/List and filters client-side by today's date prefix.
 * staleTime is ORDERS (2 min) so this refreshes frequently without hammering the API.
 */
export default function DashboardOrderCount() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useOrdersSummary();

  const todayCount = data?.todayCount ?? 0;

  // ── LOADING ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        className={cn(
          'flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4',
          'min-h-[72px]'
        )}
        aria-busy="true"
        aria-label="Loading today's order count"
      >
        <Loader2
          size={20}
          className="animate-spin text-muted-foreground shrink-0"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-1.5">
          <div className="h-3 w-24 rounded bg-muted animate-pulse" />
          <div className="h-5 w-16 rounded bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  // ── ERROR ──────────────────────────────────────────────────
  if (isError) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-4 rounded-xl',
          'border border-destructive/30 bg-destructive/5 px-5 py-4',
          'min-h-[72px]'
        )}
        role="alert"
      >
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle size={18} aria-hidden="true" className="shrink-0" />
          <p className="text-sm">Could not load today's orders.</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className={cn(
            'text-xs font-medium text-destructive underline-offset-2 hover:underline shrink-0',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
          aria-label="Retry loading today's orders"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── DATA ───────────────────────────────────────────────────
  return (
    <button
      type="button"
      onClick={() => router.push('/orders')}
      aria-label={`Today's orders: ${todayCount}. Tap to view orders.`}
      className={cn(
        'flex items-center gap-4 w-full text-left',
        'rounded-xl border border-border bg-card px-5 py-4 min-h-[72px]',
        'transition-all duration-150 active:scale-[0.99]',
        'hover:shadow-sm hover:border-primary/30',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
      )}
    >
      {/* Icon */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10"
        aria-hidden="true"
      >
        <ClipboardList size={20} className="text-primary" />
      </div>

      {/* Text */}
      <div className="flex flex-col">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Today's Orders
        </p>
        <p className="text-2xl font-bold tabular-nums leading-tight">
          {todayCount}
        </p>
      </div>
    </button>
  );
}
