'use client';

// src/components/features/products/ProductImageGallery.jsx
//
// IMAGE SOURCE PRIORITY (future-proof):
//   1. shopifyImages prop  — passed from product detail page via useShopifyProductImages
//   2. OrnaVerse fields    — product.image, image_1 … image_8 (currently null on UAT)
//   3. NoImagePlaceholder  — when both sources are empty
//
// To switch image source in future (e.g. OrnaVerse starts serving images):
//   Stop passing shopifyImages prop from the page — the component automatically
//   falls back to OrnaVerse fields. No changes needed here.
//
// FIX: this file used to carry its own local copy of the OrnaVerse path
// resolver (resolveOrnaverseSrc), separate from lib/resolveImageSrc.js.
// That local copy never got the "upload/" path-prefix fix applied to the
// shared helper, so it was silently still broken here even after the
// catalog grid was fixed — it just never showed because OrnaVerse's
// native image fields are null on UAT. Now imports the shared,
// corrected resolveImageSrc instead of maintaining a second copy.

import { useState, useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import ProductImageZoomModal from '@/components/features/products/ProductImageZoomModal';
import { resolveImageSrc } from '@/lib/resolveImageSrc';
import { Skeleton } from '@/components/ui/skeleton';

// Known colour keywords used in Shopify image `alt` text. Anything whose alt
// doesn't match one of these (e.g. "Cert") is treated as colour-agnostic and
// always shown alongside whichever colour is active.
const COLOR_KEYWORDS = ['yellow', 'rose', 'white'];

function altMatchesColor(alt, colorNameLower) {
  if (!alt) return false;
  const altLower = alt.toLowerCase();
  return colorNameLower.includes(altLower) || altLower.includes(colorNameLower);
}

function isColorAgnostic(alt) {
  if (!alt) return true;
  const altLower = alt.toLowerCase();
  return !COLOR_KEYWORDS.some((kw) => altLower.includes(kw));
}

function filterShopifyImagesByColor(shopifyImages, activeColorName) {
  if (!activeColorName || shopifyImages.length === 0) return shopifyImages;

  const colorNameLower = activeColorName.toLowerCase();
  const matched = shopifyImages.filter(
    (img) => altMatchesColor(img.alt, colorNameLower) || isColorAgnostic(img.alt)
  );

  // Defensive fallback — if the active colour name doesn't match anything
  // (e.g. an unexpected colour name we haven't seen), show everything
  // rather than an empty gallery.
  return matched.length > 0 ? matched : shopifyImages;
}



function NoImagePlaceholder() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="48" height="48"
        viewBox="0 0 24 24"
        fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        className="text-muted-foreground/50" aria-hidden="true"
      >
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
      <span className="text-xs text-muted-foreground">No image available</span>
    </div>
  );
}

function GallerySkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="w-full rounded-2xl" style={{ aspectRatio: '1 / 1' }} />
      <div className="flex gap-2 justify-center">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="w-14 h-14 rounded-lg shrink-0" />
        ))}
      </div>
    </div>
  );
}

/**
  * @param {object}   product         — OrnaVerse item/style object
 * @param {Array}    shopifyImages   — [{ id, src, alt, width, height, position }]
 *                                     from useShopifyProductImages; defaults to []
 * @param {string}   activeColorName — the currently active item's metal_color_name
 *                                     (e.g. "Yellow Gold"), used to filter shopifyImages
 *                                     down to just that colour's photos
 * @param {boolean}  isLoading       — true while variant/Shopify data is still
 *                                     resolving — shows a skeleton instead of
 *                                     the "no image" empty state
 */
export default function ProductImageGallery({ product, shopifyImages = [], activeColorName = null, isLoading = false }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imgErrors, setImgErrors]       = useState({});
  const [zoomOpen, setZoomOpen]         = useState(false);
  const touchStartX                     = useRef(null);

  // ── Build image list ───────────────────────────────────────────────────────
    // Priority 1: Shopify images (sorted by position, already done in hook),
  //             filtered down to the active variant's colour.
  // Priority 2: OrnaVerse image fields (currently null on UAT)
  const images = (() => {
    if (shopifyImages.length > 0) {
      const filtered = filterShopifyImagesByColor(shopifyImages, activeColorName);
      return filtered.map((img) => ({
        src: img.src,
        alt: img.alt ?? product?.item_name ?? 'Product image',
      }));
    }
    // Fall back to OrnaVerse fields
    const fields = [
      product?.image,
      product?.image_1,
      product?.image_2,
      product?.image_3,
      product?.image_4,
      product?.image_5,
      product?.image_6,
      product?.image_7,
      product?.image_8,
    ];
    return fields
      .map(resolveImageSrc)
      .filter(Boolean)
      .map((src) => ({ src, alt: product?.item_name ?? 'Product image' }));
  })();

  // Reset to the first image whenever the filtered set changes shape (e.g.
  // switching colour) so we don't end up pointed at an index that no longer
  // exists in the new, shorter filtered list.
  const safeIndex = currentIndex < images.length ? currentIndex : 0;

  // ── Touch swipe ───────────────────────────────────────────────────────────
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd   = (e) => {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 40) delta > 0 ? goNext() : goPrev();
    touchStartX.current = null;
  };

  const goPrev = () => setCurrentIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  const goNext = () => setCurrentIndex((i) => (i === images.length - 1 ? 0 : i + 1));
  const handleImgError = (index) => setImgErrors((prev) => ({ ...prev, [index]: true }));

  // Genuinely loading (no data of any kind to show yet) — skeleton, not the
  // hard "no image" state.
  if (isLoading && images.length === 0) {
    return <GallerySkeleton />;
  }

  const current   = images[safeIndex];
  const showImage = images.length > 0 && current?.src && !imgErrors[safeIndex];

  return (
    <div className="flex flex-col gap-3">

      {/* Main image */}
      <div
        className="relative w-full overflow-hidden rounded-2xl bg-muted"
        style={{ aspectRatio: '1 / 1' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        aria-label="Product image gallery"
      >
        {showImage ? (
          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            aria-label="Tap to zoom image"
            className="absolute inset-0 h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            <Image
              key={current.src}
              src={current.src}
              alt={current.alt}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority
              onError={() => handleImgError(safeIndex)}
            />
          </button>
        ) : (
          <NoImagePlaceholder />
        )}

        {/* Zoom button — bg-white/text-stone chrome here is intentional: it
            floats over arbitrary product-photo content, not the app's own
            themed background, so it stays fixed-light regardless of .dark. */}
        {showImage && (
          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            aria-label="Open image zoom"
            className="absolute right-2 bottom-2 flex items-center justify-center w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm shadow-sm text-stone-600 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
          >
            <ZoomIn size={16} />
          </button>
        )}

        {images.length > 1 && (
          <>
            <button onClick={goPrev} aria-label="Previous image"
              className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm shadow-sm text-stone-600 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors">
              <ChevronLeft size={18} />
            </button>
            <button onClick={goNext} aria-label="Next image"
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm shadow-sm text-stone-600 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors">
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      {/* Zoom hint */}
      {showImage && (
        <p className="text-center text-xs text-muted-foreground -mt-1">
          Tap image to zoom
        </p>
      )}

      {/* Thumbnail strip — replaces dot indicators */}
      {images.length > 1 && (
        <div
          role="tablist"
          aria-label="Image thumbnails"
          className="flex items-center gap-2 overflow-x-auto scrollbar-none px-0.5 py-0.5"
        >
          {images.map((img, i) => (
            <button
              key={img.src}
              role="tab"
              aria-selected={i === safeIndex}
              aria-label={`Image ${i + 1}`}
              onClick={() => setCurrentIndex(i)}
              className={`relative w-14 h-14 shrink-0 rounded-lg overflow-hidden border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                i === safeIndex ? 'border-accent' : 'border-transparent hover:border-border'
              }`}
            >
              {!imgErrors[i] ? (
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  sizes="56px"
                  className="object-cover"
                  onError={() => handleImgError(i)}
                />
              ) : (
                <div className="w-full h-full bg-muted" />
              )}
            </button>
          ))}
        </div>
      )}

      <ProductImageZoomModal
        isOpen={zoomOpen}
        onClose={() => setZoomOpen(false)}
        images={images}
        currentIndex={safeIndex}
        onIndexChange={setCurrentIndex}
      />
    </div>
  );
}