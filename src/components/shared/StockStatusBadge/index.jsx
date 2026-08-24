'use client';

// src/components/shared/StockStatusBadge/index.jsx
//
// Handles two different stock field patterns from OrnaVerse:
//   ProductCatalog/List  → has_stock: boolean, current_company_pieces: number
//   Items/Retrieve       → IsInStockJournal: 0 | 1

import { Badge } from '@/components/ui/badge';

/**
 * Derives status from raw stock API response (useProductStock hook).
 *
 * Binary only (in_stock / out_stock) — a "low_stock" tier was removed
 * 2026-08-13. No field in any OrnaVerse response backs a real low-stock
 * concept; it was a client-side quantity guess (n <= 3), and the UI never
 * had a real third visual state for it — see products/[itemId]/page.jsx's
 * own note from 2026-07-26 about the exact same thing happening there.
 */
export function deriveStockStatus(stockData) {
  if (!stockData) return null;

  const qty =
    stockData.closing_stock ??
    stockData.stock_qty     ??
    stockData.quantity      ??
    stockData.available_qty ??
    stockData.stock         ??
    null;

  if (qty !== null) {
    return parseFloat(qty) <= 0 ? 'out_stock' : 'in_stock';
  }

  if (typeof stockData.in_stock === 'boolean') {
    return stockData.in_stock ? 'in_stock' : 'out_stock';
  }

  return null;
}

// PREMIUM REVAMP (2026-07-22) — was hardcoding its own emerald/amber/red
// Tailwind palette instead of routing through this app's own
// --status-in-stock/--status-made-order/--status-error tokens (already
// defined in globals.css and already mapped to bg-status-*/text-status-*
// utilities — this component just wasn't using them).

const CONFIG = {
  in_stock:  { label: 'In Stock',      classes: 'bg-status-in-stock/10 text-status-in-stock ring-1 ring-status-in-stock/20' },
  out_stock: { label: 'Made to Order', classes: 'bg-status-error/10 text-status-error ring-1 ring-status-error/20' },
  // A failed stock check, not a confirmed zero — see useStockByStores'
  // isError. MUST render distinctly from in_stock/out_stock; the old
  // `CONFIG[status] ?? CONFIG.in_stock` fallback below used to silently
  // claim "In Stock" for any unrecognized status, which would have made
  // this exact case actively misleading instead of just missing.
  error:     { label: 'Stock Unknown', classes: 'bg-status-made-order/10 text-status-made-order ring-1 ring-status-made-order/20' },
};

export default function StockStatusBadge({ status, size = 'md' }) {
  const config = status ? CONFIG[status] : null;
  if (!config) return null;

  const { label, classes } = config;
  const sizeClasses = size === 'sm'
    ? 'h-auto px-2 py-0.5 text-[11px]'
    : 'h-auto px-3 py-1 text-xs';

  return (
    <Badge className={`rounded-full font-medium ${sizeClasses} ${classes}`}>
      {label}
    </Badge>
  );
}
