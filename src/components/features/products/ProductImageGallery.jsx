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

import { useState, useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import ProductImageZoomModal from '@/components/features/products/ProductImageZoomModal';

const IMAGE_BASE_URL = process.env.NEXT_PUBLIC_ORNAVERSE_BASE_URL
  ? `${process.env.NEXT_PUBLIC_ORNAVERSE_BASE_URL}/`.replace(/\/\/$/, '/')
  : '';

function resolveOrnaverseSrc(raw) {
  if (!raw || raw === 'NA') return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) return raw;
  if (IMAGE_BASE_URL) return `${IMAGE_BASE_URL}${raw}`;
  return null;
}

function NoImagePlaceholder() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-stone-50">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="48" height="48"
        viewBox="0 0 24 24"
        fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        className="text-stone-300" aria-hidden="true"
      >
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
      <span className="text-xs text-stone-400">No image available</span>
    </div>
  );
}

/**
 * @param {object}   product       — OrnaVerse item/style object
 * @param {Array}    shopifyImages — [{ id, src, alt, width, height, position }]
 *                                   from useShopifyProductImages; defaults to []
 */
export default function ProductImageGallery({ product, shopifyImages = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imgErrors, setImgErrors]       = useState({});
  const [zoomOpen, setZoomOpen]         = useState(false);
  const touchStartX                     = useRef(null);

  // ── Build image list ───────────────────────────────────────────────────────
  // Priority 1: Shopify images (sorted by position, already done in hook)
  // Priority 2: OrnaVerse image fields (currently null on UAT)
  const images = (() => {
    if (shopifyImages.length > 0) {
      return shopifyImages.map((img) => ({
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
      .map(resolveOrnaverseSrc)
      .filter(Boolean)
      .map((src) => ({ src, alt: product?.item_name ?? 'Product image' }));
  })();

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

  const current   = images[currentIndex];
  const showImage = images.length > 0 && current?.src && !imgErrors[currentIndex];

  return (
    <div className="flex flex-col gap-3">

      {/* Main image */}
      <div
        className="relative w-full overflow-hidden rounded-2xl bg-stone-50"
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
              onError={() => handleImgError(currentIndex)}
            />
          </button>
        ) : (
          <NoImagePlaceholder />
        )}

        {/* Zoom button */}
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
              className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm shadow-sm text-stone-600 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors">
              <ChevronLeft size={18} />
            </button>
            <button onClick={goNext} aria-label="Next image"
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm shadow-sm text-stone-600 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors">
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

      {/* Dot indicators */}
      {images.length > 1 && (
        <div role="tablist" aria-label="Image thumbnails" className="flex items-center justify-center gap-1.5">
          {images.map((_, i) => (
            <button
              key={i} role="tab"
              aria-selected={i === currentIndex}
              aria-label={`Image ${i + 1}`}
              onClick={() => setCurrentIndex(i)}
              className={`rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                i === currentIndex ? 'w-4 h-2 bg-amber-500' : 'w-2 h-2 bg-stone-300 hover:bg-stone-400'
              }`}
            />
          ))}
        </div>
      )}

      <ProductImageZoomModal
        isOpen={zoomOpen}
        onClose={() => setZoomOpen(false)}
        images={images}
        currentIndex={currentIndex}
        onIndexChange={setCurrentIndex}
      />
    </div>
  );
}