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
import { Gem } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { resolveImageSrc } from '@/lib/resolveImageSrc';
import APP_CONFIG          from '@/constants/appConfig';
import StarRating          from '@/components/shared/StarRating';
import { useStyleExternalProductId } from '@/hooks/products/useStyleExternalProductId';
import { useProductReviewSummary }   from '@/hooks/products/useProductReviewSummary';
import { Badge } from '@/components/ui/badge';
import { EASE_PREMIUM, DURATION } from '@/lib/motion';

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
// On-brand instead of a generic "broken image" glyph — a jewellery app's
// missing-photo state shouldn't look like an error, since it isn't one
// (most catalog rows genuinely have no photo asset yet, see header note).
function NoImagePlaceholder() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-grad-accent-wash bg-muted">
      <Gem
        size={30}
        strokeWidth={1.25}
        className="text-accent/50"
        aria-hidden="true"
      />
      <span className="text-[10px] text-muted-foreground/60 tracking-wide">No image</span>
    </div>
  );
}

// ── Stock Badge ───────────────────────────────────────────────────────────────
// Flag/tag shape flush to the card's left edge (square on the left, rounded
// on the right) rather than a floating pill — reads as a tag stuck to the
// corner of the card instead of a badge hovering over the photo.
function StockBadge({ inStock }) {
  return (
    <Badge
      className={[
        'h-auto rounded-l-none rounded-r-full py-1 pl-2.5 pr-3 text-[11px] font-semibold text-white shadow-sm',
        inStock ? 'bg-status-in-stock/95' : 'bg-status-error/95',
      ].join(' ')}
    >
      {inStock ? 'In Stock' : 'Out of Stock'}
    </Badge>
  );
}

// ── ProductCard ───────────────────────────────────────────────────────────────

export default function ProductCard({ product, showStockBadge = false }) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const reduceMotion = useReducedMotion();

  const {
    item_id,
    item_code,
    item_name,
    has_stock,
    weight,
    net_weight,
    metal_id,
    karat_code,
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
  // Purity/karat when the API gives us a real one — "NA" (mostly synthetic
  // stone rows) is dropped rather than shown as a literal "NA".
  const karatLabel   = karat_code && karat_code !== 'NA' ? karat_code : null;
  // Metal name + karat together (e.g. "Silver 925"), falling back to
  // whichever of the two is actually present.
  const metalKaratLabel = [metalLabel, karatLabel].filter(Boolean).join(' ') || null;

  const infoLine = [metalKaratLabel, weightLabel].filter(Boolean).join(' · ') || null;

  const rawSrc  = image ?? image_url ?? image_1 ?? null;
  const imageSrc = !imgError ? resolveImageSrc(rawSrc) : null;

  function handleTap() {
    if (!item_id) return;
    router.push(`/products/${item_id}`);
  }

  return (
    <motion.button
      type="button"
      onClick={handleTap}
      className={[
        'group relative flex flex-col overflow-hidden rounded-2xl border bg-card text-left',
        'shadow-sm transition-all duration-standard ease-premium',
        'hover:shadow-md hover:border-accent/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        !inStock && 'opacity-60',
      ].filter(Boolean).join(' ')}
      aria-label={`View ${item_name ?? item_code ?? 'product'}`}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      transition={{ duration: DURATION.micro, ease: EASE_PREMIUM }}
    >
      {/* ── Image ─────────────────────────────────────────── */}
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
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
          <div className="absolute left-0 top-3">
            <StockBadge inStock={inStock} />
          </div>
        )}
      </div>

      {/* ── Info ──────────────────────────────────────────── */}
      {/* Divider between the photo and details — a deliberate seam rather
          than the two areas just running together. */}
      <div className="flex flex-1 flex-col gap-1.5 border-t border-border p-3.5">

        {/* Karat · Weight (left) — rating + review count (right), sharing
            one row instead of the rating stranding itself on its own line. */}
        {(infoLine || ratingCount > 0) && (
          <div className="flex items-center gap-2">
            {infoLine && (
              <span className="truncate text-xs text-muted-foreground">
                {infoLine}
              </span>
            )}
            {ratingCount > 0 && (
              <span className="ml-auto shrink-0">
                <StarRating rating={ratingAverage} count={ratingCount} size="sm" />
              </span>
            )}
          </div>
        )}

        {/* Price — real offer price, no slashed/original price (no such
            field exists anywhere in the API — see header note) */}
        {price != null && (
          <p className="font-sans text-lg font-bold text-foreground">
            {formatINR(price)}
          </p>
        )}

        {/* Name */}
        {item_name && item_name !== item_code && (
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {item_name}
          </p>
        )}

      </div>
    </motion.button>
  );
}
