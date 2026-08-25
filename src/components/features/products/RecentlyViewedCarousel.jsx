'use client';

// src/components/features/products/RecentlyViewedCarousel.jsx
//
// "Recently Viewed" strip at the bottom of the product detail page.
// Sourced entirely from Redux (see hooks/products/useRecentlyViewed.js) —
// only ever populated for an attached customer, since nothing gets
// recorded for a walk-in with no customer attached. Renders nothing at all
// (not even the heading) when the list is empty, same "don't show an empty
// section" convention ProductReviewsList already uses.
//
// REVAMPED 2026-08-22 to a real Swiper carousel (freeMode drag/swipe +
// arrow navigation) — was a plain overflow-x-auto flex row, which scrolled
// fine but had none of a carousel's affordances (no arrows, no momentum/
// snap feel, nothing to signal "there's more, scroll me"). First carousel
// library in this codebase — everywhere else (ProductImageGallery) hand-
// rolls its own swipe handling, but that one is tightly coupled to the zoom
// modal's index model; this is a simple horizontal shelf with nothing else
// depending on its internals, so pulling in Swiper here rather than hand-
// rolling a second bespoke implementation.
//
// Cards are the EXACT catalog ProductCard component (2026-08-22), not a
// bespoke look-alike — the item snapshot stored by useRecentlyViewed.js is
// shaped specifically to match what that component expects (metal_id,
// karat_code, has_stock; see that hook's deriveKaratCode for the one field
// it has to translate). This also means star ratings, the stock badge, and
// tap-to-navigate all come for free instead of being re-implemented here.
//
// Prices are ALWAYS live, never the value stored at view time — reuses the
// exact same useLiveCatalogPrices pipeline the catalog page uses, for the
// same reason: a stored price is a snapshot that can be minutes-to-days
// stale by the time this renders, and this app treats a stale price as a
// real bug everywhere else (see that hook's own header comment).

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode, Navigation, Mousewheel } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/free-mode';
// Deliberately NOT importing 'swiper/css/navigation' — that stylesheet's
// default .swiper-button-next/-prev look (theme-blue circle, its own glyph)
// out-specificities Tailwind's utility classes on NavButton below, since
// Swiper's CSS loads after Tailwind's in the bundle and ties go to source
// order. Navigation's click-to-advance behavior only needs the class names
// to find the elements — it doesn't need this stylesheet at all — so
// skipping the import is simpler than fighting its cascade with more `!`
// overrides.
//
// NOTE: never override .swiper's own `overflow: hidden` (e.g. an
// `overflow-visible!` className) — that's what clips slides to the visible
// carousel width. Without it every slide renders full-width in normal
// document flow and bleeds past the viewport, which grows the WHOLE PAGE a
// horizontal scrollbar instead of just this strip. Confirmed live 2026-08-22.
import ProductCard from '@/components/features/catalog/ProductCard';
import { useLiveCatalogPrices } from '@/hooks/catalog/useLiveCatalogPrices';
import { useRecentlyViewedItems } from '@/hooks/products/useRecentlyViewed';

// Arrow buttons target Swiper's own nav elements by class (swiper-button-prev/
// -next are how the Navigation module wires click handlers — renaming these
// classes silently breaks navigation, so they're deliberately kept even
// though the visual styling is entirely ours via Tailwind, not Swiper's CSS).
function NavButton({ direction }) {
  const isPrev = direction === 'prev';
  return (
    <button
      type="button"
      aria-label={isPrev ? 'Previous' : 'Next'}
      className={[
        isPrev ? 'swiper-button-prev' : 'swiper-button-next',
        'after:hidden', // kill Swiper's default arrow-glyph pseudo-element — using lucide icons instead
        'flex! h-9! w-9! items-center justify-center rounded-full border border-border',
        'bg-card text-foreground shadow-sm hover:bg-muted',
        'top-1/2! mt-0! -translate-y-1/2',
        'disabled:opacity-0!', // Swiper adds .swiper-button-disabled at either end; hide rather than show a dead button
      ].join(' ')}
    >
      {isPrev ? <ChevronLeft size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
    </button>
  );
}

/**
 * @param {{ excludeItemId?: number|string|null }} props
 *   excludeItemId — the product currently on screen, filtered out of the
 *   list so it never shows up recommending itself.
 */
export default function RecentlyViewedCarousel({ excludeItemId = null }) {
  const items = useRecentlyViewedItems(excludeItemId);

  // Same shape useLiveCatalogPrices expects elsewhere: objects with
  // item_id + price (always null here — see header comment for why).
  const { priceById, settledIds } = useLiveCatalogPrices(items);

  if (items.length === 0) return null;

  return (
    <section className="relative flex flex-col gap-4">
      <h2 className="font-heading text-lg text-foreground">Recently Viewed</h2>

      <div className="group/carousel relative -mx-4 px-4 md:-mx-6 md:px-6">
        <Swiper
          modules={[FreeMode, Navigation, Mousewheel]}
          freeMode
          navigation={{ prevEl: '.swiper-button-prev', nextEl: '.swiper-button-next' }}
          // Touch drags and the arrow buttons work without this — this is
          // specifically for trackpad/mouse-wheel input, which is the most
          // common way a desktop user "swipes" a horizontal carousel and
          // which Swiper otherwise ignores entirely, letting the gesture
          // fall straight through to the page's own vertical scroll (the
          // exact "whole page scrolls instead of the carousel" bug this
          // fixes). forceToAxis: only capture wheel/trackpad input whose
          // dominant motion is horizontal — a normal vertical scroll over
          // this section must keep scrolling the page, not get hijacked.
          mousewheel={{ forceToAxis: true }}
          // Card width is DERIVED from how many should be visible, not fixed
          // — matches this app's own sm/md/lg breakpoints (see BottomSheet's
          // md: switch for the same convention) rather than Swiper's default
          // 320/480/640/768 set. 1.5 on mobile is deliberate, not a typo: a
          // half-visible card is what signals "swipe for more" — a clean 1
          // looks like a single full-width banner with nothing beyond it.
          slidesPerView={1.5}
          spaceBetween={12}
          breakpoints={{
            768:  { slidesPerView: 2.5, spaceBetween: 12 }, // tablet
            1024: { slidesPerView: 3.5, spaceBetween: 16 }, // desktop
            1200: { slidesPerView: 5, spaceBetween: 16 }, // desktop
          }}
        >
          {items.map((item) => {
            const price = priceById.get(item.item_id) ?? null;
            const isPricing = price == null && !settledIds.has(item.item_id);
            return (
              <SwiperSlide key={item.item_id}>
                {/* showStockBadge — matches the catalog grid's own card
                    exactly (same component, same props), so this carousel
                    reads as the same product picker, not a stripped-down
                    variant of it. */}
                <ProductCard
                  product={{ ...item, price, is_pricing: isPricing }}
                  showStockBadge
                />
              </SwiperSlide>
            );
          })}
        </Swiper>

        {/* Arrows only worth showing once there's more than fits on screen —
            Swiper hides them itself (.swiper-button-disabled/.swiper-button-lock)
            at either end or when every slide already fits, so no extra
            item-count check needed here. Faded in on hover/focus on
            pointer devices; always visible on touch (no hover state to
            reveal them there).
            z-10 is load-bearing, not decorative: Swiper's own base CSS gives
            .swiper `position: relative; z-index: 1`, which — despite these
            divs coming later in the DOM — otherwise paints ON TOP of them
            (an explicit z-index always beats a later z-index:auto sibling,
            regardless of source order). Without this, clicks meant for the
            arrow fall through to whichever slide is underneath it instead. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden items-center pl-1 opacity-0 transition-opacity duration-standard group-hover/carousel:opacity-100 sm:flex [&>button]:pointer-events-auto">
          <NavButton direction="prev" />
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden items-center pr-1 opacity-0 transition-opacity duration-standard group-hover/carousel:opacity-100 sm:flex [&>button]:pointer-events-auto">
          <NavButton direction="next" />
        </div>
      </div>
    </section>
  );
}
