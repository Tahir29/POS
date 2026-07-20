'use client';

// src/components/features/dashboard/TodaysActivityStrip/index.jsx
//
// NOTE: A "Schemes" chip is intentionally NOT included — there's no
// SchemeReceipt/List data source yet (Phase 23, still queued). Add it
// here once that hook exists; don't fabricate a count in the meantime.

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

function ActivityChip({ count, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm text-foreground">
      <span className="font-semibold tabular-nums">{count}</span>
      {label}
    </span>
  );
}

/**
 * @param {{ returns: number, exchanges: number, buybacks: number, isLoading?: boolean }} props
 */
export default function TodaysActivityStrip({ returns = 0, exchanges = 0, buybacks = 0, isLoading }) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <Skeleton className="h-3 w-28 mb-3" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Today&rsquo;s Activity
      </h2>
      <div className="flex flex-wrap gap-2">
        <ActivityChip count={returns}   label={returns === 1 ? 'Return' : 'Returns'} />
        <ActivityChip count={exchanges} label={exchanges === 1 ? 'Exchange' : 'Exchanges'} />
        <ActivityChip count={buybacks}  label={buybacks === 1 ? 'Buyback' : 'Buybacks'} />
      </div>
    </div>
  );
}