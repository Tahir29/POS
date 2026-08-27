'use client';

import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// `accent` marks this as the ONE primary metric on the dashboard row
// (Today's Revenue) that gets the terracotta treatment; every other
// card stays neutral so the accent still reads as a single signal
// rather than being repeated across all three cards.
//
// `icon` — optional decorative badge on the card's right side (dashboard
// redesign reference). Purely visual reinforcement of what the metric
// already says in words; omit it and the card still reads fine, so it's
// not load-bearing for any screen reader/data purpose.
//
// `sparkline` — FIXED 2026-08-27: dashboard/page.jsx already computed and
// passed this (revenueSparkline, per-day revenue buckets from
// useDashboardSummary) but this component destructured it and never once
// read it — the trend line it was clearly built to show never reached the
// screen. Rendered below as a plain inline SVG polyline, auto-scaled to the
// series' own min/max — no charting library, this is the smallest possible
// shape that's still a real trend line, not just a decorative squiggle.
// Purely decorative like `icon` (the trend arrow/text above it already say
// the same thing in words), so it's aria-hidden and silently omits itself
// under two points (nothing to draw a trend between).
function Sparkline({ data }) {
  if (!data || data.length < 2) return null;

  const width = 100;
  const height = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // flat series (all-equal) — avoid /0, draw a flat line instead

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="mt-2 h-7 w-full text-accent/60"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
      <div className="rounded-xl border border-border bg-card shadow-sm px-5 py-4">
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
        'flex items-start justify-between gap-3 rounded-xl border bg-card shadow-sm px-5 py-4 transition-shadow duration-standard ease-premium hover:shadow-md',
        accent ? 'border-accent/30 bg-accent/5' : 'border-border'
      )}
    >
      <div className="min-w-0 flex flex-col justify-between h-full">
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

        <Sparkline data={sparkline} />
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
