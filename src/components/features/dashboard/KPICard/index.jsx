'use client';

import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── KPI CARD ──────────────────────────────────────────────────
//
// No icon glyph by design — the card leads with label + figure only.
// `accent` marks this as the ONE primary metric on the dashboard row
// (Today's Revenue) that gets the terracotta treatment; every other
// card stays neutral so the accent still reads as a single signal
// rather than being repeated across all three cards.

/**
 * @param {{
 *   label: string,
 *   value: string,
 *   trend?: { type: 'up' | 'down' | 'warning' | 'neutral', text: string },
 *   sparkline?: number[],
 *   isLoading?: boolean,
 *   accent?: boolean,
 * }} props
 */
export default function KPICard({ label, value, trend, sparkline, isLoading, accent = false }) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <div className="h-3 w-24 rounded bg-muted animate-pulse mb-3" />
        <div className="h-7 w-20 rounded bg-muted animate-pulse mb-4" />
        <div className="h-8 w-full rounded bg-muted animate-pulse" />
      </div>
    );
  }

  const trendColor =
    trend?.type === 'up'      ? 'text-status-in-stock' :
    trend?.type === 'warning' ? 'text-amber-600' :
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
        'rounded-xl border bg-card px-5 py-4',
        accent ? 'border-accent/30' : 'border-border'
      )}
    >
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
        <p className={cn('flex items-center gap-1 text-xs font-medium mb-3', trendColor)}>
          {TrendIcon && <TrendIcon size={12} aria-hidden="true" />}
          {trend.text}
        </p>
      )}
    </div>
  );
}