'use client';

import { useRouter } from 'next/navigation';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import APP_CONFIG from '@/constants/appConfig';

// ── HELPERS ───────────────────────────────────────────────────

/**
 * Formats a number as an INR currency string.
 * Falls back gracefully when price is null / undefined / 0.
 * @param {number|null|undefined} value
 * @returns {string}
 */
function formatPrice(value) {
  if (value == null || value === 0) return null;
  return new Intl.NumberFormat('en-IN', {
    style:    'currency',
    currency: APP_CONFIG.CURRENCY.INR_CODE,
    maximumFractionDigits: 0,
  }).format(value);
}

// ── COMPONENT ─────────────────────────────────────────────────

/**
 * ProductMiniCard
 *
 * Compact card used inside ProductCarouselStrip.
 * Navigates to the product detail page on tap.
 *
 * OrnaVerse Items/List response fields used:
 *   item_id        — used for navigation key + route param
 *   item_code      — secondary label (SKU)
 *   item_name      — primary display name
 *   item_image_url — product thumbnail (may be absent)
 *   sales_rate     — price shown on card (may be absent pre-UAT)
 *
 * All fields are treated as nullable — the card renders
 * gracefully even when price or image are missing.
 *
 * @param {{ item: object, className?: string }} props
 */
export default function ProductMiniCard({ item, className }) {
  const router = useRouter();

  const imageUrl  = item?.item_image_url ?? item?.image_url ?? null;
  const itemName  = item?.item_name  ?? 'Unnamed Product';
  const itemCode  = item?.item_code  ?? '';
  const itemId    = item?.item_id;
  const price     = formatPrice(item?.sales_rate ?? item?.rate ?? null);

  const handleTap = () => {
    if (itemId) {
      router.push(`/products/${itemId}`);
    }
  };

  return (
    <button
      type="button"
      onClick={handleTap}
      disabled={!itemId}
      aria-label={`View ${itemName}${price ? `, priced at ${price}` : ''}`}
      className={cn(
        // Sizing — fixed width so carousel scroll works correctly
        'w-36 shrink-0 flex flex-col rounded-xl overflow-hidden',
        'bg-card border border-border text-left',
        // Interaction
        'transition-all duration-150 active:scale-[0.97]',
        'hover:shadow-md hover:border-primary/30',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        // Disabled (no item_id)
        !itemId && 'opacity-50 cursor-default',
        className
      )}
    >
      {/* Thumbnail */}
      <div className="relative h-36 w-full bg-muted flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={itemName}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(e) => {
              // Replace broken image with fallback icon
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        {/* Fallback — shown when image is absent or broken */}
        <div
          className={cn(
            'flex flex-col items-center justify-center gap-1 text-muted-foreground',
            imageUrl ? 'hidden' : 'flex'
          )}
          aria-hidden="true"
        >
          <ImageOff size={20} />
          <span className="text-xs">No image</span>
        </div>
      </div>

      {/* Details */}
      <div className="flex flex-col gap-0.5 p-2.5">
        {/* Item name — clamp to 2 lines */}
        <p className="text-xs font-medium leading-tight line-clamp-2 text-foreground">
          {itemName}
        </p>

        {/* Item code */}
        {itemCode && (
          <p className="text-[10px] text-muted-foreground truncate">
            {itemCode}
          </p>
        )}

        {/* Price */}
        {price && (
          <p className="text-xs font-semibold text-foreground mt-1">
            {price}
          </p>
        )}
      </div>
    </button>
  );
}
