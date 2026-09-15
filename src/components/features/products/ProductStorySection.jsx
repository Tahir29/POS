'use client';

// "Story Behind The Product" — a design-craft narrative block, placed right
// below the trust-badge strip (ProductTrustBadge) on the product detail page.
//
// Ported from a shared reference design (a specific product's story: the
// Round Solitaire Swirl Engagement Ring). No OrnaVerse or Shopify field
// currently carries a genuine per-product "story" — same situation
// ProductTrustSection.jsx already documents for its own static content — so
// this renders that reference copy as its DEFAULT, but takes title/body/image
// as props so a real per-product story can be wired in later the moment one
// exists, without touching this component again.
//
// unoptimized on the image: same reasoning as ProductTrustSection's fixed
// marketing images — a single hand-picked asset, not worth Vercel's
// optimizer machinery for something that never varies at request time.

import Image from 'next/image';

const DEFAULT_TITLE = 'Story Behind The Product';

const DEFAULT_BODY =
  'The Round Solitaire Swirl Engagement Ring is a stunning blend of modern ' +
  'elegance and timeless romance. Featuring a brilliant round-cut center ' +
  'stone, this ring is designed with an artistic, swirling band that ' +
  'gracefully wraps around the diamond, creating a delicate yet dynamic ' +
  'look. The fluid lines of the metal setting enhance the sparkle of the ' +
  'solitaire stone, making it the focal point of the design.';

const DEFAULT_IMAGE = 'https://cdn.shopify.com/s/files/1/0739/8516/3482/files/story-ring.jpg';

/**
 * @param {{ title?: string, body?: string, imageSrc?: string, imageAlt?: string }} props
 */
export default function ProductStorySection({
  title = DEFAULT_TITLE,
  body = DEFAULT_BODY,
  imageSrc = DEFAULT_IMAGE,
  imageAlt = 'Hand-drawn sketch of the piece’s design',
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-10">
      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-2xl text-foreground">{title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>

      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl">
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
