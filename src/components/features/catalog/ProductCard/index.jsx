'use client';

// src/components/features/catalog/ProductCard/index.jsx
// Individual product card for the catalog grid.
// Stock badge always visible on every card.
// OOS cards dimmed to 60% opacity — still tappable for detail view.
// Navigates to /products/[item_id] on tap.

import { useState }    from 'react';
import Image           from 'next/image';
import { useRouter }   from 'next/navigation';
import { resolveImageSrc } from '@/lib/resolveImageSrc';
import APP_CONFIG      from '@/constants/appConfig';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(amount) {
  if (!amount && amount !== 0) return null;
  return new Intl.NumberFormat('en-IN', {
    style:                'currency',
    currency:             APP_CONFIG.CURRENCY.INR_CODE,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Derives stock status from OrnaVerse catalog product object.
 * Checks all known field patterns defensively.
 * IsInStockJournal: 1 = in stock, 0 = out of stock (confirmed field name).
 */
function getStockStatus(product) {
  // Confirmed OrnaVerse field
  if (product.IsInStockJournal !== undefined) {
    return product.IsInStockJournal === 1 || product.IsInStockJournal === true;
  }
  if (typeof product.in_stock === 'boolean') return product.in_stock;
  const qty =
    product.stock_qty   ??
    product.available_qty ??
    product.quantity    ??
    product.stock       ??
    null;
  if (qty !== null) return qty > 0;
  // Default to in-stock if no stock field found
  return true;
}

// ── No-image placeholder ──────────────────────────────────────────────────────

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

// ── Stock Badge ───────────────────────────────────────────────────────────────
// Always rendered — top-right corner overlay on the image.

function StockBadge({ inStock }) {
  if (inStock) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-500/90 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm backdrop-blur-sm">
        In Stock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-red-500/90 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm backdrop-blur-sm">
      Out of Stock
    </span>
  );
}

// ── ProductCard ───────────────────────────────────────────────────────────────

/**
 * @param {{ product: object, showStockBadge?: boolean }} props
 * showStockBadge defaults to true — pass false to hide badge in pure browse mode.
 */
export default function ProductCard({ product, showStockBadge = true }) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);

  const {
    item_id,
    item_code,
    item_name,
    item_rate,
    sale_price,
    price,
    mrp,
    image,
    image_url,
    image_1,
  } = product;

  // Price: item_rate is primary per architecture; fall back to others
  const displayPrice = item_rate ?? sale_price ?? price ?? mrp ?? null;
  const formattedPrice = formatPrice(displayPrice);

  const inStock = getStockStatus(product);

  // Resolve image — uses shared resolver from lib
  // Tries image → image_url → image_1, treats "NA" and empty as null
  const rawSrc  = image ?? image_url ?? image_1 ?? null;
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
        'group relative flex flex-col overflow-hidden rounded-2xl border bg-white text-left',
        'shadow-sm transition-all duration-200',
        'hover:shadow-md hover:-translate-y-0.5',
        'active:scale-[0.98] active:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        !inStock && 'opacity-60',
      ].filter(Boolean).join(' ')}
      aria-label={`View ${item_name ?? 'product'}`}
    >
      {/* ── Product Image ──────────────────────────────────── */}
      <div className="relative aspect-square w-full overflow-hidden bg-stone-50">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={item_name ?? 'Product image'}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <NoImagePlaceholder />
        )}

        {/* Stock badge — always top-right */}
        {showStockBadge && (
          <div className="absolute right-2 top-2">
            <StockBadge inStock={inStock} />
          </div>
        )}
      </div>

      {/* ── Product Info ───────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-0.5 p-3">
        {/* Item code / SKU */}
        {item_code && (
          <p className="truncate text-[10px] font-medium uppercase tracking-wider text-stone-400">
            {item_code}
          </p>
        )}

        {/* Product name */}
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-stone-800">
          {item_name ?? 'Unnamed Product'}
        </p>

        {/* Price — accent colour, bottom of card */}
        {formattedPrice && (
          <p className="mt-auto pt-2 text-sm font-bold text-[#B77767]">
            {formattedPrice}
          </p>
        )}

        {/* Accent underline — matches design's orange dash */}
        <div className="mt-1.5 h-0.5 w-6 rounded-full bg-[#B77767]" aria-hidden="true" />
      </div>
    </button>
  );
}