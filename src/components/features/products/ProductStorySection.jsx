'use client';

// "Story Behind The Product" — a design-craft narrative block, placed right
// below the trust-badge strip (ProductTrustBadge) on the product detail page.
//
// CONTENT SOURCE (2026-09-16): `body` is Shopify's own product description
// (descriptionHtml), fetched via useShopifyProductImages — the SAME request
// the image gallery already makes for this product, so this rides along for
// free rather than costing a second round trip. Confirmed live against this
// store's real Shopify catalog that descriptionHtml genuinely varies
// per-product (it isn't boilerplate) — see product-media/route.js's own
// header for the two real products this was checked against. `title` stays
// a fixed section label (every reference example used the same heading,
// only the body copy changed) and `imageSrc` stays the one static
// illustration — Shopify has no per-product equivalent asset for this
// (checked the same two products' full media list: colour-variant photos,
// a certificate image, two videos — nothing resembling a design sketch).
// All three still take props, so a genuine per-product image (or a
// different fixed illustration) is a one-line change whenever one exists.
//
// isLoading/body are the caller's own useShopifyProductImages state (see
// page.jsx) — this section renders nothing while that's still in flight,
// and nothing at all if a product genuinely has no description once it
// resolves, rather than showing copy that doesn't belong to the product on
// screen.
//
// LAYOUT (revised 2026-09-16, reported feedback: "image too big on desktop,
// content reads too pale to bother with"):
//   - 50/50 (grid-cols-2) stays for tablet only — that's the width it was
//     confirmed to already look right at. From lg: up, the grid becomes 5
//     tracks with text taking 3 and the image 2, so the image's own box
//     shrinks (and its fixed aspect-ratio shrinks its height right along
//     with it) as the viewport gets wider, instead of scaling up 1:1 with
//     an ever-widening 50% column.
//   - Body copy moved off text-muted-foreground (this app's "secondary/
//     caption" tone, which is exactly why it read as skippable) onto
//     text-foreground/90 at a larger size, and given a left accent rule —
//     a plain paragraph of gray text has no visual entry point; the rule
//     gives the eye somewhere to land before it starts reading down the
//     copy, the same reason a pull-quote treatment works in print.
//
// unoptimized on the image: same reasoning as ProductTrustSection's fixed
// marketing images — a single hand-picked asset, not worth Vercel's
// optimizer machinery for something that never varies at request time.

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import tracker from '@/lib/analytics/tracker';
import EVENTS from '@/lib/analytics/events';
import { buildProductAttributes } from '@/lib/analytics/productAttributes';

const DEFAULT_TITLE = 'Story Behind The Product';
const DEFAULT_IMAGE = 'https://cdn.shopify.com/s/files/1/0739/8516/3482/files/story-ring.jpg';

function StorySkeleton() {
  return (
    <div className="grid grid-cols-1 items-center gap-6 rounded-2xl border border-border bg-card p-5 shadow-sm md:grid-cols-2 md:gap-10 md:p-8 lg:grid-cols-5">
      <div className="flex flex-col gap-3 lg:col-span-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-3/4" />
        <div className="flex flex-col gap-2 pt-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
      <Skeleton className="aspect-[16/10] w-full rounded-2xl lg:col-span-2" />
    </div>
  );
}

/**
 * @param {{
 *   body?: string|null,
 *   isLoading?: boolean,
 *   title?: string,
 *   imageSrc?: string,
 *   imageAlt?: string,
 *   product?: object|null,
 * }} props
 *   body/isLoading — pass useShopifyProductImages' own `description`/
 *   `isLoading` straight through (see page.jsx); this component makes no
 *   fetch of its own.
 *   product — identity only, for PRODUCT_STORY_VIEWED (buildProductAttributes);
 *   never used for rendering. Optional so this stays usable standalone.
 */
export default function ProductStorySection({
  body = null,
  isLoading = false,
  title = DEFAULT_TITLE,
  imageSrc = DEFAULT_IMAGE,
  imageAlt = 'Hand-drawn sketch of the piece’s design',
  product = null,
}) {
  // PRODUCT_STORY_VIEWED — fires once per product, exactly when this
  // section actually has real content to show (same condition as the
  // `!body` render gate below), not merely once the section mounts.
  const trackedItemIdRef = useRef(null);
  useEffect(() => {
    if (isLoading || !body || !product?.item_id) return;
    if (trackedItemIdRef.current === product.item_id) return;
    trackedItemIdRef.current = product.item_id;

    tracker.track(EVENTS.PRODUCT_STORY_VIEWED, buildProductAttributes({ product }));
  }, [isLoading, body, product]);

  if (isLoading) return <StorySkeleton />;
  // A product genuinely without a Shopify description has no real story to
  // tell here — better to skip the section than show generic filler text
  // that doesn't actually describe what's on screen.
  if (!body) return null;

  return (
    <div className="grid grid-cols-1 items-center gap-6 rounded-2xl border border-border bg-card p-5 shadow-sm md:grid-cols-1 md:gap-10 md:p-8 lg:grid-cols-5 lg:gap-12">
      <div className="flex flex-col gap-4 lg:col-span-3">
        <div className="flex items-center gap-1.5 text-accent">
          <Sparkles size={13} aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-[0.15em]">
            Crafted With Care
          </span>
        </div>
        <h2 className="font-heading text-2xl text-foreground md:text-3xl">{title}</h2>

        {/* Left accent rule — gives the paragraph a visual entry point
            instead of starting cold as an undifferentiated block of gray
            text (the exact "pale, easy to skip" feedback this addresses).
            Body copy itself moved off text-muted-foreground (this app's
            caption/secondary tone) up to text-foreground/90 at text-base,
            since this is content meant to be read, not a footnote. */}
        <div className="border-l-2 border-accent/50 pl-4">
          <p className="text-base leading-relaxed text-foreground/90">{body}</p>
        </div>
      </div>

      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl shadow-sm lg:col-span-2">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          className="object-cover"
          unoptimized
        />
      </div>
    </div>
  );
}
