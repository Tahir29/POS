'use client';

// Stock status badge. deriveStockStatus() normalizes the differing stock
// field names OrnaVerse's endpoints return (ProductCatalog/List uses
// has_stock/current_company_pieces; Items/Retrieve uses IsInStockJournal)
// into a single in_stock/out_stock value.

import { Badge } from '@/components/ui/badge';

/** Derives status from a raw stock API response (useProductStock hook). Binary only. */
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

const CONFIG = {
  in_stock:  { label: 'In Stock',      classes: 'bg-status-in-stock/10 text-status-in-stock ring-1 ring-status-in-stock/20' },
  out_stock: { label: 'Made to Order', classes: 'bg-status-error/10 text-status-error ring-1 ring-status-error/20' },
  // A failed stock check (see useStockByStores' isError), not a confirmed
  // zero — must render distinctly from in_stock/out_stock, never silently
  // fall back to "In Stock" for an unrecognized status.
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
