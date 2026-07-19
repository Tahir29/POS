'use client';

// src/components/features/catalog/ProductCard/index.jsx
//
// SCHEMA: ProductCatalogRow doesn't reliably return a price field at all on
// this environment — catalogService.enrichWithPrice fills it in from
// Items/List's item_rate (see that file for details). `price` here is
// always that real, single offer price.
//
// Fields used: item_id, item_code, item_name, has_stock, weight, net_weight,
// metal_id, karat_id, image/image_1, price.
//
// NOT rendered — confirmed 2026-07-15 there's no backing data for any of
// these anywhere in the API (checked directly, not assumed):
//   - Slashed "original price" / % off badge — no compare_price, mrp, or
//     any "original price" field exists on any item/catalog endpoint
//   - Tags (e.g. "Fast Shipping") — no tags field exists at all
//   - Similar products — the field exists (similar_items) but is empty on
//     every product in this catalog
//   - Wishlist, video icon, variant colour swatches — by product decision,
//     not a data gap
//
// Star ratings (added 2026-07-19, Nector integration) — ONLY shown for
// products with a style_id. Nector indexes reviews by Shopify product ID,
// which this app can only resolve via style_id → Style/Retrieve →
// external_product_id; plain (non-variant) items have no such link and a
// 100-item sample showed 0/100 carry a style_id at all, so most cards will
// never show a rating row — that's expected, not a bug. See
// useStyleExternalProductId.js for why this doesn't add a second network
// call when the product detail page has already resolved the same style.

import { useState }        from 'react';
import Image               from 'next/image';
import { useRouter }       from 'next/navigation';
import { resolveImageSrc } from '@/lib/resolveImageSrc';
import APP_CONFIG          from '@/constants/appConfig';
import StarRating          from '@/components/shared/StarRating';
import { useStyleExternalProductId } from '@/hooks/products/useStyleExternalProductId';
import { useProductReviewSummary }   from '@/hooks/products/useProductReviewSummary';

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
    style_id,
  } = product;

  const { externalProductId } = useStyleExternalProductId(style_id ?? null);
  const { average: ratingAverage, count: ratingCount } = useProductReviewSummary(externalProductId);

  const inStock      = has_stock === true;
  const metalLabel   = getMetalLabel(metal_id);
  const weightLabel  = formatWeight(net_weight ?? weight ?? null);

  const infoLine = [metalLabel, weightLabel].filter(Boolean).join(' · ') || null;

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

        {/* Price — real offer price, no slashed/original price (no such
            field exists anywhere in the API — see header note) */}
        {price != null && (
          <p className="font-heading text-base font-semibold text-foreground">
            {formatINR(price)}
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

        {/* Star rating — only ever renders for products with real review
            data (see header note on why most cards won't have one) */}
        {ratingCount > 0 && (
          <StarRating rating={ratingAverage} count={ratingCount} size="sm" />
        )}

      </div>
    </button>
  );
}
