'use client';

// src/components/features/catalog/ProductCard/index.jsx
//
// SCHEMA (confirmed v1.json, see catalogService.js header comment):
//   ProductCatalogRow already includes price + compare_price directly —
//   no per-card detail fetch needed. The older note claiming price wasn't
//   available on this endpoint was stale (pre-rewire) and has been
//   corrected here.
//
// Fields used: item_id, item_code, item_name, has_stock, weight, net_weight,
// metal_id, karat_id, image/image_1, price, compare_price.
//
// NOT rendered (no data source at this endpoint, confirmed during audit):
//   - Bestseller / Fast Shipping / New Arrival tags — skipped per decision
//   - Diamond weight (ct) — not a confirmed ProductCatalogRow field
//   - Multiple variant/color dots — only ONE dot for the item's own metal_id

import { useState }        from 'react';
import Image               from 'next/image';
import { useRouter }       from 'next/navigation';
import { resolveImageSrc } from '@/lib/resolveImageSrc';
import APP_CONFIG          from '@/constants/appConfig';

// ── Metal type label + swatch color ───────────────────────────────────────────
// Swatch colors are a presentation mapping (not fabricated data) — the
// metal_id itself is real; this just gives each metal a recognizable dot.
const METAL_ID_TO_NAME = Object.fromEntries(
  Object.entries(APP_CONFIG.METAL_TYPES).map(([name, id]) => [
    id,
    name.charAt(0) + name.slice(1).toLowerCase(),
  ])
);

function getMetalLabel(metal_id) {
  return metal_id ? METAL_ID_TO_NAME[metal_id] ?? null : null;
}

// ── Weight formatter ──────────────────────────────────────────────────────────
function formatWeight(grams) {
  if (!grams && grams !== 0) return null;
  const n = Number(grams);
  if (isNaN(n) || n === 0) return null;
  return `${n.toFixed(3)} g`;
}

// ── Price formatter ────────────────────────────────────────────────────────────
function formatINR(value) {
  if (value == null) return null;
  return `₹${Number(value).toLocaleString('en-IN')}`;
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
function StockBadge({ inStock }) {
  if (inStock) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-500/90 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm">
        In Stock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-red-500/90 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm">
      Out of Stock
    </span>
  );
}

// ── ProductCard ───────────────────────────────────────────────────────────────

export default function ProductCard({ product, showStockBadge = false }) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);

  const {
    item_id,
    item_code,
    item_name,
    has_stock,
    weight,
    net_weight,
    metal_id,
    image,
    image_url,
    image_1,
    price,
    compare_price,
  } = product;

  const inStock      = has_stock === true;
  const metalLabel   = getMetalLabel(metal_id);
  const weightLabel  = formatWeight(net_weight ?? weight ?? null);

  const infoLine = [metalLabel, weightLabel].filter(Boolean).join(' · ') || null;

  const hasDiscount = compare_price != null && price != null && compare_price > price;
  const discountPct = hasDiscount ? Math.round((1 - price / compare_price) * 100) : null;

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
      aria-label={`View ${item_name ?? item_code ?? 'product'}`}
    >
      {/* ── Image ─────────────────────────────────────────── */}
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

        {showStockBadge && (
          <div className="absolute right-2 top-2">
            <StockBadge inStock={inStock} />
          </div>
        )}
      </div>

      {/* ── Info ──────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-1 p-3">

        {/* Price row — real price/compare_price from ProductCatalogRow */}
        {price != null && (
          <p className="flex items-baseline gap-1.5">
            <span className="font-heading text-base font-semibold text-foreground">
              {formatINR(price)}
            </span>
            {hasDiscount && (
              <>
                <span className="text-xs text-muted-foreground line-through">
                  {formatINR(compare_price)}
                </span>
                <span className="text-xs font-semibold text-status-in-stock">
                  {discountPct}% off
                </span>
              </>
            )}
          </p>
        )}

        {/* Name */}
        {item_name && item_name !== item_code && (
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-stone-800">
            {item_name}
          </p>
        )}

        {/* Metal type · Weight */}
        {infoLine && (
          <p className="text-xs text-muted-foreground">
            {infoLine}
          </p>
        )}
        
      </div>
    </button>
  );
}
