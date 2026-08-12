'use client';

import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// ── KPI CARD ──────────────────────────────────────────────────
//
// `accent` marks this as the ONE primary metric on the dashboard row
// (Today's Revenue) that gets the terracotta treatment; every other
// card stays neutral so the accent still reads as a single signal
// rather than being repeated across all three cards.
//
// `icon` — optional decorative badge on the card's right side (dashboard
// redesign reference). Purely visual reinforcement of what the metric
// already says in words; omit it and the card still reads fine, so it's
// not load-bearing for any screen reader/data purpose.

/**
 * @param {{
 *   label: string,
 *   value: string,
 *   trend?: { type: 'up' | 'down' | 'warning' | 'neutral', text: string },
 *   sparkline?: number[],
 *   icon?: React.ElementType,
 *   isLoading?: boolean,
 *   accent?: boolean,
 * }} props
 */
export default function KPICard({ label, value, trend, sparkline, icon: Icon, isLoading, accent = false }) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-7 w-20 mb-4" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  const trendColor =
    trend?.type === 'up'      ? 'text-status-in-stock' :
    trend?.type === 'warning' ? 'text-status-made-order' :
    trend?.type === 'down'    ? 'text-destructive' :
    'text-muted-foreground';

  const TrendIcon =
    trend?.type === 'up'      ? TrendingUp :
    trend?.type === 'warning' ? AlertTriangle :
    trend?.type === 'down'    ? TrendingDown :
    null;

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 rounded-xl border bg-card px-5 py-4',
        accent ? 'border-accent/30 bg-accent/5' : 'border-border'
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          {label}
        </p>

        <p
          className={cn(
            'font-heading text-3xl mb-2 tabular-nums leading-none',
            accent ? 'text-accent' : 'text-foreground'
          )}
        >
          {value}
        </p>

        {trend && (
          <p className={cn('flex items-center gap-1 text-xs font-medium', trendColor)}>
            {TrendIcon && <TrendIcon size={12} aria-hidden="true" />}
            {trend.text}
          </p>
        )}
      </div>

      {Icon && (
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
            accent ? 'bg-accent/15 text-accent' : 'bg-secondary text-primary'
          )}
          aria-hidden="true"
        >
          <Icon size={20} />
        </span>
      )}
    </div>
  );
}
