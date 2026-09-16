'use client';

// "Today's Rate" — a compact 9K/18K/22K/24K gold-rate strip on the product
// detail page, placed right above PriceBreakdown. REDESIGNED 2026-09-16
// (feedback: the first pass matched PriceBreakdown's own card chrome —
// bordered card, icon-in-circle header bar, "Today's Rate" title — and
// that's more structure than this needs; a plain strip reads better here,
// no heading required). Now mirrors MetalRatesTicker's own inline strip
// language directly (tinted status-made-order background, small Coins
// icon, one row of "9K: ₹X,XXX.XX/g" chips) rather than a second, heavier
// visual style next to it.
//
// Reuses useMetalRates() — the same per-karat GetMetalRate pipeline behind
// the dashboard's MetalRatesTicker — rather than a second rate source; see
// that hook's own header for why the karat universe is a hardcoded id/code
// list (GetMetalRate has no "list all karats" mode). Passing RATE_CODES
// means this only fires 4 GetMetalRate calls, not all 11 the dashboard
// strip fires; both share the same query cache/keys, so a session that's
// already visited the dashboard paints this instantly from cache.
//
// OrnaVerse's own raw codes: 24K gold is reported as '999' (99.9% purity),
// not a literal '24' — see useMetalRates.js's KARAT_RATES. KARAT_LABELS
// below maps the 4 codes this strip cares about to the "9K/18K/22K/24K"
// labels a shopper actually expects. Only rates that have actually
// resolved are shown (same as MetalRatesTicker) — no "—" placeholders for
// a still-loading or failed karat.

import { Coins } from 'lucide-react';
import { useMetalRates } from '@/hooks/settings/useMetalRates';

const KARAT_LABELS = { '09': '9K', '18': '18K', '22': '22K', '999': '24K' };
const RATE_CODES = Object.keys(KARAT_LABELS);

const money = (n) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/g`;

export default function TodaysRateStrip() {
  const { rates, hasAny } = useMetalRates(RATE_CODES);

  // Same rule as MetalRatesTicker — never show a strip of nothing.
  if (!hasAny) return null;

  const resolved = rates.filter((r) => r.rate != null);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-status-made-order/25 bg-status-made-order/10 px-4 py-2.5">
      <Coins size={13} className="shrink-0 text-status-made-order" aria-hidden="true" />
      {resolved.map((r) => (
        <span
          key={r.code}
          className="whitespace-nowrap text-xs font-semibold tabular-nums text-status-made-order"
        >
          {KARAT_LABELS[r.code]}: {money(r.rate)}
        </span>
      ))}
    </div>
  );
}
