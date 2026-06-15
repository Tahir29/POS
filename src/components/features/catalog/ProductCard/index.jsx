'use client';

// src/components/features/catalog/ProductCard/index.jsx
// Individual product card for the catalog grid.
// Shows: product image, name, item code, price, stock badge.
// Navigates to /products/[item_id] on tap.
// Touch target: min 44x44px per CODING_STANDARDS Section 12.

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import APP_CONFIG from '@/constants/appConfig';

// ── Image URL resolver ────────────────────────────────────────────────────────
// Handles three cases from OrnaVerse API:
//   1. Already a full URL  → use as-is
//   2. Already starts with / → use as-is
//   3. Raw filename (e.g. "LGERB02734XXVJ.jpg") → prefix with base URL
const IMAGE_BASE_URL = process.env.NEXT_PUBLIC_ORNAVERSE_BASE_URL
  ? `${process.env.NEXT_PUBLIC_ORNAVERSE_BASE_URL}/`.replace(/\/\/$/, '/')
  : '';

function resolveImageSrc(raw) {
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) return raw;
  if (IMAGE_BASE_URL) return `${IMAGE_BASE_URL}${raw}`;
  return null;
}

// ── No-image placeholder ──────────────────────────────────────────────────────
// Shown when: no image field on item, URL resolves to null, or image fails to load.

function NoImagePlaceholder() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-stone-50">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-stone-300"
        aria-hidden="true"
      >
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
      <span className="text-[10px] text-stone-300 tracking-wide">No image</span>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Formats a numeric amount as INR currency string.
 * Falls back to '—' when price is absent or zero.
 */
function formatPrice(amount) {
  if (!amount && amount !== 0) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: APP_CONFIG.CURRENCY.INR_CODE,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Derives a stock status from the catalog product object.
 * OrnaVerse may surface this as `in_stock`, `stock_qty`, or `available`.
 * We check all known field patterns defensively.
 */
function getStockStatus(product) {
  if (typeof product.in_stock === 'boolean') return product.in_stock;
  const qty =
    product.stock_qty ??
    product.available_qty ??
    product.quantity ??
    product.stock ??
    null;
  if (qty !== null) return qty > 0;
  return true;
}

// ── Stock Badge ───────────────────────────────────────────────────────────────

function StockBadge({ inStock }) {
  if (inStock) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20">
        In Stock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 ring-1 ring-red-500/20">
      Out of Stock
    </span>
  );
}

// ── ProductCard ───────────────────────────────────────────────────────────────

/**
 * @param {{ product: object }} props
 * product shape (OrnaVerse catalog fields):
 *   item_id, item_code, item_name, sale_price / price / mrp,
 *   image_url / image, in_stock, stock_qty
 */
export default function ProductCard({ product }) {
  const router = useRouter();

  // imgError: set to true by onError when the resolved URL fails to load
  const [imgError, setImgError] = useState(false);

  const {
    item_id,
    item_code,
    item_name,
    sale_price,
    price,
    mrp,
    image_url,
    image,
  } = product;

  const displayPrice = sale_price ?? price ?? mrp ?? null;
  const inStock      = getStockStatus(product);

  // Try all common OrnaVerse image field names, then resolve to a valid src.
  // If imgError is true (onError fired), skip straight to placeholder.
  const rawSrc  = image_url ?? image ?? null;
  const imageSrc = !imgError ? resolveImageSrc(rawSrc) : null;

  function handleTap() {
    if (!item_id) return;
    router.push(`/products/${item_id}`);
  }

  return (
    <button
      type="button"
      onClick={handleTap}
      className={[
        'group relative flex flex-col overflow-hidden rounded-xl border bg-white text-left',
        'shadow-sm transition-all duration-200',
        'hover:shadow-md hover:-translate-y-0.5',
        'active:scale-[0.98] active:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2',
        !inStock && 'opacity-75',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`View ${item_name}`}
    >
      {/* ── Product Image ──────────────────────────────────── */}
      <div className="relative aspect-square w-full overflow-hidden bg-stone-50">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={item_name ?? 'Product image'}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <NoImagePlaceholder />
        )}

        {/* Stock badge — top-right overlay */}
        <div className="absolute right-2 top-2">
          <StockBadge inStock={inStock} />
        </div>
      </div>

      {/* ── Product Info ───────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        {/* Item code / SKU */}
        {item_code && (
          <p className="truncate text-[11px] font-medium uppercase tracking-wider text-stone-400">
            {item_code}
          </p>
        )}

        {/* Product name */}
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-stone-800">
          {item_name ?? 'Unnamed Product'}
        </p>

        {/* Price */}
        <p className="mt-auto pt-2 text-base font-bold text-amber-700">
          {formatPrice(displayPrice)}
        </p>
      </div>
    </button>
  );
}