'use client';

import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── SPARKLINE ─────────────────────────────────────────────────
// Tiny inline SVG line chart. Renders a flat mid-line if there isn't
// enough variance in the data (e.g. all zeros) rather than a
// misleading zig-zag.

function Sparkline({ data = [], accent }) {
  const width  = 120;
  const height = 32;

  if (!data.length || data.every((v) => v === data[0])) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-8" aria-hidden="true">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      </svg>
    );
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const points = data
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-8" aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

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

      {sparkline && (
        <div className={accent ? 'text-accent' : 'text-muted-foreground/50'}>
          <Sparkline data={sparkline} accent={accent} />
        </div>
      )}
    </div>
  );
}