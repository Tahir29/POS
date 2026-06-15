'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, PackageOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import ProductMiniCard from '@/components/features/dashboard/ProductMiniCard';

// ── SKELETON ──────────────────────────────────────────────────

/**
 * CarouselSkeleton
 * Renders placeholder cards while data is loading.
 * Count matches the visible card count on a typical tablet viewport.
 */
function CarouselSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="w-36 shrink-0 rounded-xl bg-muted animate-pulse"
          style={{ height: '176px' }}
        />
      ))}
    </div>
  );
}

// ── EMPTY STATE ───────────────────────────────────────────────

/**
 * CarouselEmpty
 * Shown when the API returns an empty array.
 */
function CarouselEmpty({ label }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-muted-foreground">
      <PackageOpen size={18} aria-hidden="true" />
      <p className="text-sm">No {label.toLowerCase()} to show right now.</p>
    </div>
  );
}

// ── ERROR STATE ───────────────────────────────────────────────

/**
 * CarouselError
 * Shown when the API call fails. Provides a retry button.
 */
function CarouselError({ label, onRetry }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4">
      <div className="flex items-center gap-2 text-destructive">
        <AlertCircle size={16} aria-hidden="true" />
        <p className="text-sm">Failed to load {label.toLowerCase()}.</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            'text-xs font-medium text-destructive underline-offset-2 hover:underline',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
          aria-label={`Retry loading ${label}`}
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ── SCROLL ARROW BUTTON ───────────────────────────────────────

/**
 * ScrollArrow
 * Chevron button for mouse/keyboard scroll on non-touch devices.
 * Hidden on touch devices (users swipe directly).
 */
function ScrollArrow({ direction, onClick, disabled }) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight;
  const label = direction === 'left' ? 'Scroll left' : 'Scroll right';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        // Hide on touch viewports — shown on pointer devices
        'hidden md:flex',
        'items-center justify-center',
        'w-8 h-8 rounded-full border border-border bg-card shadow-sm',
        'text-muted-foreground hover:text-foreground hover:bg-accent',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:opacity-30 disabled:pointer-events-none',
        'shrink-0'
      )}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────

/**
 * ProductCarouselStrip
 *
 * A horizontally scrollable strip of ProductMiniCards.
 * Handles all four states: loading, error, empty, and data.
 *
 * Scroll behaviour:
 *   - Touch devices: native overflow-x scroll with snap
 *   - Mouse/keyboard: ChevronLeft / ChevronRight buttons scroll by ~3 cards
 *
 * Props:
 *   title    {string}  — Section heading displayed above the strip
 *   items    {Array}   — Array of item objects from OrnaVerse Items/List
 *   isLoading {boolean} — Show skeleton state
 *   isError   {boolean} — Show error state
 *   onRetry   {Function} — Called when the user clicks Retry in error state
 *   className {string}  — Optional extra classes on the root section
 */
export default function ProductCarouselStrip({
  title,
  items = [],
  isLoading = false,
  isError   = false,
  onRetry,
  className,
}) {
  const scrollRef = useRef(null);

  // Scroll by ~3 card widths (144px card + 12px gap ≈ 156px × 3)
  const SCROLL_AMOUNT = 468;

  const scroll = (direction) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left:     direction === 'left' ? -SCROLL_AMOUNT : SCROLL_AMOUNT,
      behavior: 'smooth',
    });
  };

  // Unique section ID for aria-labelledby
  const headingId = `carousel-heading-${title.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <section
      aria-labelledby={headingId}
      className={cn('flex flex-col gap-3', className)}
    >
      {/* Header row — title + scroll arrows */}
      <div className="flex items-center justify-between">
        <h2
          id={headingId}
          className="text-sm font-medium text-muted-foreground uppercase tracking-wider"
        >
          {title}
        </h2>

        {/* Arrows — only visible on md+ and when there is data */}
        {!isLoading && !isError && items.length > 0 && (
          <div className="flex items-center gap-1">
            <ScrollArrow direction="left"  onClick={() => scroll('left')}  />
            <ScrollArrow direction="right" onClick={() => scroll('right')} />
          </div>
        )}
      </div>

      {/* Content area */}
      {isLoading ? (
        <CarouselSkeleton />
      ) : isError ? (
        <CarouselError label={title} onRetry={onRetry} />
      ) : items.length === 0 ? (
        <CarouselEmpty label={title} />
      ) : (
        <div
          ref={scrollRef}
          role="list"
          aria-label={`${title} products`}
          className={cn(
            'flex gap-3 overflow-x-auto',
            // Hide scrollbar visually but keep it functional
            'scrollbar-none',
            // Snap scroll for tablet swipe UX
            'scroll-smooth snap-x snap-mandatory',
            // Prevent layout shift by reserving height
            'pb-1'
          )}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item) => (
            <div
              key={item?.item_id ?? item?.item_code ?? Math.random()}
              role="listitem"
              className="snap-start"
            >
              <ProductMiniCard item={item} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
