'use client';

// src/components/shared/StockStatusBadge/index.jsx
//
// Handles two different stock field patterns from OrnaVerse:
//   ProductCatalog/List  → has_stock: boolean, current_company_pieces: number
//   Items/Retrieve       → IsInStockJournal: 0 | 1

const LOW_STOCK_THRESHOLD = 3;

/**
 * Derives status from raw stock API response (useProductStock hook).
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
    const n = parseFloat(qty);
    if (n <= 0)                   return 'out_stock';
    if (n <= LOW_STOCK_THRESHOLD) return 'low_stock';
    return 'in_stock';
  }

  if (typeof stockData.in_stock === 'boolean') {
    return stockData.in_stock ? 'in_stock' : 'out_stock';
  }

  return null;
}

/**
 * Derives status from a product object.
 *
 * Priority order:
 * 1. current_company_pieces  — from ProductCatalog/List (most accurate for active store)
 * 2. has_stock               — from ProductCatalog/List (boolean fallback)
 * 3. IsInStockJournal        — from Items/Retrieve (1 = in stock)
 * 4. stock_qty / quantity    — generic numeric fallback
 */
export function deriveStockStatusFromProduct(product) {
  if (!product) return null;

  // ProductCatalog/List — pieces at current store
  if (product.current_company_pieces !== undefined) {
    const pieces = Number(product.current_company_pieces);
    if (pieces <= 0)                   return 'out_stock';
    if (pieces <= LOW_STOCK_THRESHOLD) return 'low_stock';
    return 'in_stock';
  }

  // ProductCatalog/List — boolean fallback
  if (typeof product.has_stock === 'boolean') {
    return product.has_stock ? 'in_stock' : 'out_stock';
  }

  // Items/Retrieve — IsInStockJournal
  if (product.IsInStockJournal !== undefined) {
    return (product.IsInStockJournal === 1 || product.IsInStockJournal === true)
      ? 'in_stock'
      : 'out_stock';
  }

  // Generic numeric fallback
  const qty =
    product.stock_qty     ??
    product.available_qty ??
    product.quantity      ??
    product.stock         ??
    null;

  if (qty !== null) {
    const n = parseFloat(qty);
    if (n <= 0)                   return 'out_stock';
    if (n <= LOW_STOCK_THRESHOLD) return 'low_stock';
    return 'in_stock';
  }

  return 'in_stock'; // optimistic default
}

// ── Badge config ──────────────────────────────────────────────────────────────

const CONFIG = {
  in_stock:  { label: 'In Stock',     classes: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  low_stock: { label: 'Low Stock',    classes: 'bg-amber-50  text-amber-700  ring-amber-500/20'    },
  out_stock: { label: 'Out of Stock', classes: 'bg-red-50    text-red-600    ring-red-500/20'      },
};

export default function StockStatusBadge({ status, size = 'md' }) {
  if (!status) return null;

  const { label, classes } = CONFIG[status] ?? CONFIG.in_stock;
  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-[11px]'
    : 'px-3 py-1 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ring-1 ${sizeClasses} ${classes}`}>
      {label}
    </span>
  );
}
