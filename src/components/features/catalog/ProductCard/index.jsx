'use client';

// SCHEMA: ProductCatalogRow doesn't return a usable price on this
// environment. `price` here is filled in out-of-band by useLiveCatalogPrices
// from Helpers/SetSalesItems — the same calculator checkout bills from, so
// what's on the card is what the customer pays (plus GST). It is null until
// that resolves, and stays null for anything that can't be priced; render
// no price rather than a wrong one. See the PRICING note in
// catalogService.js for why the stored item_rate is never used.
//
// Fields used: item_id, item_code, item_name, has_stock, weight, net_weight,
// metal_id, karat_code, metal_color_code/metal_color_name, image/image_1,
// price. metal_color_code vs. metal_color_name: two different upstream
// endpoints spell this differently (short code on catalog rows, full name
// on Items/Retrieve and Style/Retrieve) — see lib/metalColor.js for why
// this card accepts either.
//
// NOT rendered — confirmed 2026-07-15 there's no backing data for any of
// these anywhere in the API (checked directly, not assumed):
//   - Slashed "original price" / % off badge — no compare_price, mrp, or
//     any "original price" field exists on any item/catalog endpoint
//   - Tags (e.g. "Fast Shipping") — no tags field exists at all
//   - Similar products — the field exists (similar_items) but is empty on
//     every product in this catalog
//   - Video icon, variant colour swatches — by product decision, not a
//     data gap
//
// WISHLIST (added 2026-08-23) — top-right heart, filled/outline from
// wishlistSlice (see hooks/products/useWishlist.js). Requires a customer
// to be attached, same rule recentlyViewed's recording follows: there's no
// party_id to key a wishlist entry to otherwise. See
// lib/mongo/wishlist.js for the Mongo side. The button itself now lives in
// components/features/products/WishlistButton.jsx (extracted same day) so
// the product detail page can render the identical heart inline instead of
// floating over an image.
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

function formatWeight(grams) {
  if (!grams && grams !== 0) return null;
  const n = Number(grams);
  if (isNaN(n) || n === 0) return null;
  return `${n.toFixed(3)} g`;
}

// Whole rupees, matching lib/priceUtils.formatPrice on the product page.
// Live prices carry fractional paise (sub_total 226444.105), and
// toLocaleString's default shows up to 3 decimals — "₹2,26,444.105" on a
// price tag reads like a bug.
function formatINR(value) {
  if (value == null) return null;
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

// On-brand instead of a generic "broken image" glyph — a jewellery app's
// missing-photo state shouldn't look like an error, since it isn't one
// (most catalog rows genuinely have no photo asset yet, see header note).
// Uses the same Logo component/asset as the sidebar mark (2026-08-23,
// swapped from a generic lucide Gem icon) — a missing-photo state is exactly
// the kind of empty space that's otherwise unbranded, so it doubles as a
// small brand touch instead of a throwaway icon with no relation to Lucira.
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

// Flag/tag shape flush to the card's left edge (square on the left, rounded
// on the right) rather than a floating pill — reads as a tag stuck to the
// corner of the card instead of a badge hovering over the photo.
//
// storeCode (2026-08-24): the catalog grid is always scoped to one active
// store (see catalog/page.jsx's activeStoreId), so "In Stock" alone never
// said WHICH store actually has the piece — only meaningful once an
// associate is comparing this card against another store's, or recalling
// it later from Recently Viewed/Wishlist. Shown only alongside "In Stock":
// "Made to Order" already means not on this store's shelf, so tagging it
// with a store code would read as a contradiction.
function StockBadge({ inStock, storeCode }) {
  return (
    <Badge
      className={[
        'h-auto rounded-l-none rounded-r-full py-1 pl-2.5 pr-3 text-[11px] font-semibold text-white shadow-sm',
        inStock ? 'bg-status-in-stock/95' : 'bg-status-error/95',
      ].join(' ')}
    >
      {inStock ? 'In Stock' : 'Made to Order'}
      {inStock && storeCode && (
        <span className="ml-1 font-bold opacity-90">· {storeCode}</span>
      )}
    </Badge>
  );
}

export default function ProductCard({ product, showStockBadge = false, storeCode: storeCodeOverride }) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const reduceMotion = useReducedMotion();
  const activeStoreCode = useSelector(selectActiveStoreCode);
  // storeCodeOverride (2026-08-24) — for a card rendered in the "Available
  // at other stores" lane (see OtherStoreSection), whose "In Stock" badge
  // must show THAT store's code, never the page's own active/browsing
  // store. Omitted everywhere else, so the badge falls back to the active
  // store as before.
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
    // Only ever populated for a wishlisted item that was a CONFIRMED
    // Customize selection (2026-08-24) — a plain catalog/recently-viewed
    // row has no size concept, so this is undefined there, same as always.
    item_size_name,
  } = product;

  const { externalProductId } = useStyleExternalProductId(style_id ?? null);
  const { average: ratingAverage, count: ratingCount } = useProductReviewSummary(externalProductId);

  const inStock      = has_stock === true;
  const metalLabel   = getMetalLabel(metal_id);
  const weightLabel  = formatWeight(net_weight ?? weight ?? null);
  // Purity/karat when the API gives us a real one — "NA" (mostly synthetic
  // stone rows) is dropped rather than shown as a literal "NA".
  const karatLabel   = karat_code && karat_code !== 'NA' ? karat_code : null;
  const metalColorName = resolveMetalColorName({ metal_color_code, metal_color_name });

  // Descriptive metal + karat label (fixed 2026-08-23 — was a terse
  // "Gold 14", which reads like two unrelated numbers next to a metal name
  // unless you already know "14" means karat; the weight next to it already
  // spells out its unit ("3.080 g"), this should too). Gold specifically
  // gets "{karat} Karat {Color} Gold" (e.g. "14 Karat Yellow Gold") when the
  // color resolves, or "{karat} Karat Gold" when it doesn't (color code/name
  // missing or unrecognized) — never a bare number. Other metals (Silver,
  // Platinum, …) keep the plain "{Metal} {code}" form, e.g. "Silver 925":
  // "Karat" isn't the right unit for a silver purity figure.
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

  // role="button" on a <div>, not a real <button> (2026-08-23) — the
  // wishlist heart added below is its OWN real <button>, and a <button>
  // cannot validly contain another <button>. It used to be one; the
  // browser's HTML parser auto-closes the outer button the instant it
  // meets the nested one, which silently detaches everything after that
  // point from the card's actual click target — confirmed live, the heart
  // toggle didn't register at all (aria-pressed never became true) and
  // React logged the exact "cannot contain a nested button" hydration
  // error. tabIndex + onKeyDown reproduce a real button's keyboard
  // behavior (Enter/Space) since a plain div gets neither for free.
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
        // h-full/w-full (2026-08-22): harmless on the catalog grid — a grid
        // item already stretches to its row's height by default, so this
        // just makes explicit what was already true there — but load-
        // bearing inside RecentlyViewedCarousel's Swiper: a slide (flex
        // item) stretches to match its row's tallest slide by default, but
        // an ORDINARY block child of that slide (this button, with no
        // height of its own) does not inherit that stretch — it only ever
        // sizes to its own content. Without this, cards whose name wraps to
        // one line vs. two ended up visibly different heights in the
        // carousel despite sitting in equal-height slides.
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
            <StockBadge inStock={inStock} storeCode={storeCode} />
          </div>
        )}

        <WishlistButton product={product} reduceMotion={reduceMotion} />
      </div>

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

        {/* Price. Live-priced, so it arrives a moment after the card — say
            what's happening instead of leaving a gap where a number belongs,
            which reads as a broken card. A card that stays unpriced is a real
            state, not a glitch: the server priced it at 0 and it cannot be
            sold (currently every Silver925 item on this tenant). */}
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
