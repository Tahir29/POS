'use client';

// Highlighted metal-rate strip, full-bleed directly under the header — same
// placement and treatment OrnaVerse's own POS uses on its dashboard
// (confirmed live 2026-08-27, lucira.uat.ornaverse.in/pos: a flat amber bar
// listing every configured karat's today rate, right below the top nav).
// See useMetalRates.js for the full data contract and why the karat list is
// a fixed, live-captured set rather than fetched from a "list karats" call
// (there isn't one).
//
// status-made-order is this app's existing "gold/informational" token
// (already literally described as "Gold" in globals.css) — reused here
// rather than introducing a new color, and it happens to be the right hue
// for a metal-rate banner regardless.
//
// Renders nothing until at least one rate has resolved, and nothing at all
// if every one of them failed — a silently-empty highlighted bar reads as a
// rendering bug, so this only ever shows real numbers or a brief loading
// state, never a blank strip.

import { Coins } from 'lucide-react';
import { useMetalRates } from '@/hooks/settings/useMetalRates';

const money = (n) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/g`;

export default function MetalRatesTicker() {
  const { rates, isLoading, hasAny } = useMetalRates();

  if (!isLoading && !hasAny) return null;

  const resolved = rates.filter((r) => r.rate != null);

  return (
    <div className="w-full border-b border-status-made-order/25 bg-status-made-order/10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2.5 md:px-6">
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
