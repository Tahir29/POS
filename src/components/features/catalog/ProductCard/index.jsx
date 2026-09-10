'use client';

// Catalog product card: image, price, and stock/rating badges.
// `price` is filled in out-of-band by useLiveCatalogPrices (the same
// calculator checkout bills from) and is null until resolved, or
// permanently for an item that can't be priced — render no price rather
// than a wrong one. metal_color_code/metal_color_name: different upstream
// endpoints spell this differently; see lib/metalColor.js.
// Star rating only renders for products with a style_id (needed to
// resolve Nector's external_product_id) — most catalog rows lack one, so
// most cards simply show no rating badge.

import { useState, memo }  from 'react';
import Image               from 'next/image';
import { useRouter }       from 'next/navigation';
import { useSelector }     from 'react-redux';
import { motion, useReducedMotion } from 'motion/react';
import { resolveImageSrc } from '@/lib/resolveImageSrc';
import { resolveMetalColorName } from '@/lib/metalColor';
import { selectActiveStoreCode } from '@/store/slices/storeSlice';
import APP_CONFIG          from '@/constants/appConfig';
import Logo                from '@/components/shared/Logo';
import StarRating          from '@/components/shared/StarRating';
import { useStyleExternalProductId } from '@/hooks/products/useStyleExternalProductId';
import { useProductReviewSummary }   from '@/hooks/products/useProductReviewSummary';
import WishlistButton       from '@/components/features/products/WishlistButton';
import { Badge } from '@/components/ui/badge';
import { EASE_PREMIUM, DURATION } from '@/lib/motion';
import { formatAmountOrNull as formatINR } from '@/lib/priceUtils';

// Swatch colors are a presentational mapping only — metal_id itself is real data.
const METAL_ID_TO_NAME = Object.fromEntries(
  Object.entries(APP_CONFIG.METAL_TYPES).map(([name, id]) => [
    id,
    name.charAt(0) + name.slice(1).toLowerCase(),
  ])
);

function getMetalLabel(metal_id) {
  return metal_id ? METAL_ID_TO_NAME[metal_id] ?? null : null;
}

function formatWeight(grams) {
  if (!grams && grams !== 0) return null;
  const n = Number(grams);
  if (isNaN(n) || n === 0) return null;
  return `${n.toFixed(3)} g`;
}

// On-brand placeholder instead of a generic "broken image" glyph — most
// catalog rows genuinely have no photo asset yet, so this isn't an error state.
function NoImagePlaceholder() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-muted">
      <Logo
        variant="icon"
        color="brown"
        width={32}
        height={32}
        className="opacity-40"
      />
      <span className="text-[10px] text-muted-foreground/60 tracking-wide">No image</span>
    </div>
  );
}

// Flag/tag shape flush to the card's left edge, not a floating pill.
// storeCodes lists every store (plural — a card can be in stock at
// several) the badge should credit; shown only alongside "In Stock",
// never "Made to Order".
function StockBadge({ inStock, storeCodes }) {
  return (
    <Badge
      className={[
        'h-auto rounded-l-none rounded-r-full py-1 pl-2.5 pr-3 text-[11px] font-semibold text-white shadow-sm',
        inStock ? 'bg-status-in-stock/95' : 'bg-status-error/95',
      ].join(' ')}
    >
      {inStock ? 'In Stock' : 'Made to Order'}
      {inStock && storeCodes?.length > 0 && (
        <span className="ml-1 font-bold opacity-90">· {storeCodes.join(', ')}</span>
      )}
    </Badge>
  );
}

/**
 * @param {{
 *   product: object,
 *   showStockBadge?: boolean,
 *   storeCode?: string,
 *   realStock?: { hasStock: boolean, storeCodes: string[] } | null,
 * }} props
 *   realStock - genuine cross-store stock for this exact item_id, from
 *   useCrossStoreStockCodes. Pass it wherever product.has_stock can't be
 *   trusted as a live, correctly-scoped verdict (Recently Viewed, Wishlist);
 *   overrides both has_stock and storeCode when present. Omitted on the
 *   main catalog grid/OtherStoreSection, where has_stock is already
 *   correctly scoped server-side.
 */
function ProductCard({ product, showStockBadge = false, storeCode: storeCodeOverride, realStock = null }) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const reduceMotion = useReducedMotion();
  const activeStoreCode = useSelector(selectActiveStoreCode);
  // storeCodeOverride lets a card (e.g. in OtherStoreSection) show a
  // different store's code than the operator's active store; ignored once
  // realStock is passed, since that's already the real answer.
  const storeCode = storeCodeOverride ?? activeStoreCode;

  const {
    item_id,
    item_code,
    item_name,
    has_stock,
    weight,
    net_weight,
    metal_id,
    karat_code,
    metal_color_code,
    metal_color_name,
    image,
    image_url,
    image_1,
    price,
    // Set by the catalog page: the live price hasn't come back yet, as
    // opposed to having come back with no sellable price.
    is_pricing: isPricing = false,
    style_id,
    // Only populated for a wishlisted item with a confirmed Customize
    // selection; a plain catalog/recently-viewed row has no size concept.
    item_size_name,
  } = product;

  const { externalProductId } = useStyleExternalProductId(style_id ?? null);
  const { average: ratingAverage, count: ratingCount } = useProductReviewSummary(externalProductId);

  const inStock      = realStock ? realStock.hasStock : has_stock === true;
  const badgeStoreCodes = realStock ? realStock.storeCodes : (storeCode ? [storeCode] : []);
  const metalLabel   = getMetalLabel(metal_id);
  const weightLabel  = formatWeight(net_weight ?? weight ?? null);
  // Purity/karat when the API gives us a real one — "NA" (mostly synthetic
  // stone rows) is dropped rather than shown as a literal "NA".
  const karatLabel   = karat_code && karat_code !== 'NA' ? karat_code : null;
  const metalColorName = resolveMetalColorName({ metal_color_code, metal_color_name });

  // Gold gets "{karat} Karat {Color} Gold" (falls back to "{karat} Karat
  // Gold" if color doesn't resolve); other metals keep "{Metal} {code}"
  // (e.g. "Silver 925") since "Karat" isn't the right unit for those.
  const metalKaratLabel = metalLabel === 'Gold' && karatLabel
    ? `${karatLabel} Karat ${metalColorName ?? 'Gold'}`
    : [metalLabel, karatLabel].filter(Boolean).join(' ') || null;

  const sizeLabel = item_size_name && item_size_name !== 'NA' ? `Size ${item_size_name}` : null;

  const infoLine = [metalKaratLabel, weightLabel, sizeLabel].filter(Boolean).join(' · ') || null;

  const rawSrc  = image ?? image_url ?? image_1 ?? null;
  const imageSrc = !imgError ? resolveImageSrc(rawSrc) : null;

  function handleTap() {
    if (!item_id) return;
    router.push(`/products/${item_id}`);
  }

  // role="button" on a <div>, not a real <button> — WishlistButton below
  // renders its own real <button>, and a <button> cannot contain another
  // <button> (the outer one used to be real; the browser auto-closes it on
  // the nested button, silently breaking the card's click target).
  // tabIndex + onKeyDown reproduce Enter/Space behavior a div lacks.
  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={handleTap}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleTap();
        }
      }}
      className={[
        // h-full/w-full: a no-op on the catalog grid, but load-bearing
        // inside RecentlyViewedCarousel's Swiper — an ordinary block child
        // doesn't inherit a flex slide's stretch on its own, so without
        // this, cards with wrapping vs. non-wrapping names got uneven heights.
        'group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-card text-left',
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
            <StockBadge inStock={inStock} storeCodes={badgeStoreCodes} />
          </div>
        )}

        <WishlistButton product={product} reduceMotion={reduceMotion} />

        {/* Rating badge floats bottom-right over the image, mirroring
            WishlistButton's top-right placement, so the specs row below
            gets the card's full width instead of being truncated early.
            `compact` forces the single-star + value + count form — a
            small corner badge has no room for 5 full stars. */}
        {ratingCount > 0 && (
          <div className="absolute bottom-2 right-2 z-10 rounded-full bg-card/90 px-2 py-1 shadow-sm backdrop-blur-sm">
            <StarRating rating={ratingAverage} count={ratingCount} compact />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 border-t border-border p-3.5">

        {infoLine && (
          <span className="truncate text-xs text-muted-foreground">
            {infoLine}
          </span>
        )}

        {/* Price is live-priced and arrives after the card mounts — show
            "Pricing…"/"Price unavailable" instead of a blank gap. Staying
            unpriced is a real, sellable-at-0 state, not a glitch. */}
        {price != null ? (
          <p className="font-sans text-lg font-bold text-foreground">
            {formatINR(price)}
          </p>
        ) : (
          <p className="font-sans text-sm font-medium text-muted-foreground">
            {isPricing ? 'Pricing…' : 'Price unavailable'}
          </p>
        )}

        {item_name && item_name !== item_code && (
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {item_name}
          </p>
        )}

      </div>
    </motion.div>
  );
}

// Memoized: the catalog grid can hold 150+ mounted cards while live pricing
// streams in, and only the few cards with a new price should re-render.
// Requires catalog/page.jsx to keep `product`'s object reference stable
// across renders when nothing changed, or this shallow-compare memo re-renders anyway.
export default memo(ProductCard);
