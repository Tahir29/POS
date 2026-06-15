'use client';

// src/components/features/products/ProductImageGallery/index.jsx
// Updated to read OrnaVerse image fields: image, image_1 through image_8.

import { useState, useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const IMAGE_BASE_URL = process.env.NEXT_PUBLIC_ORNAVERSE_BASE_URL
  ? `${process.env.NEXT_PUBLIC_ORNAVERSE_BASE_URL}/`.replace(/\/\/$/, '/')
  : '';

function resolveImageSrc(raw) {
  if (!raw) return null;
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

export default function ProductImageGallery({ product }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imgErrors, setImgErrors]       = useState({});
  const touchStartX                     = useRef(null);

  // ── Build image list from OrnaVerse fields ────────────────────────────────
  // OrnaVerse returns: image, image_1, image_2 ... image_8
  const images = (() => {
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
      .filter(Boolean); // removes nulls (fields that are null in API)
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

  const currentSrc = images[currentIndex];
  const showImage  = images.length > 0 && currentSrc && !imgErrors[currentIndex];

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
          <Image
            key={currentSrc}
            src={currentSrc}
            alt={product?.item_name ?? 'Product image'}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            priority
            onError={() => handleImgError(currentIndex)}
          />
        ) : (
          <NoImagePlaceholder />
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
    </div>
  );
}
