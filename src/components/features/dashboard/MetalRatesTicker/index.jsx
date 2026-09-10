'use client';

// Highlighted metal-rate strip, full-bleed under the header (mirrors
// OrnaVerse's own POS dashboard placement). See useMetalRates.js for the
// data contract. Renders nothing until at least one rate resolves, and
// nothing at all if every rate fails — never shows a blank/empty strip.

import { Coins } from 'lucide-react';
import { useMetalRates } from '@/hooks/settings/useMetalRates';

const money = (n) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/g`;

export default function MetalRatesTicker() {
  const { rates, isLoading, hasAny } = useMetalRates();

  if (!isLoading && !hasAny) return null;

  const resolved = rates.filter((r) => r.rate != null);

  return (
    <div className="w-full border-b border-status-made-order/25 bg-status-made-order/10">
      <div className="mx-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 px-4 py-2.5 md:px-6">
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-status-made-order">
          <Coins size={13} aria-hidden="true" />
          Today&rsquo;s Rates
        </span>

        {resolved.length === 0 ? (
          <span className="text-xs font-medium text-status-made-order/70">Loading…</span>
        ) : (
          resolved.map((r) => (
            <span
              key={r.code}
              className="whitespace-nowrap text-xs font-semibold tabular-nums text-status-made-order"
            >
              {r.code}: {money(r.rate)}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
