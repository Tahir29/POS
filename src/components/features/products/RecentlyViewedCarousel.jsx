'use client';

// "Recently Viewed" strip at the bottom of the product detail page.
// Sourced from Redux (see hooks/products/useRecentlyViewed.js) — only ever
// populated for an attached customer. Renders nothing (not even the
// heading) when the list is empty.
//
// Uses a Swiper carousel (freeMode drag/swipe + arrow navigation). Cards are
// the exact catalog ProductCard component — the item snapshot stored by
// useRecentlyViewed.js is shaped to match what it expects (metal_id,
// karat_code, has_stock; see that hook's deriveKaratCode), so star ratings,
// the stock badge, and tap-to-navigate all come for free.
//
// Prices are always fetched live (never the value stored at view time) via
// the same useLiveCatalogPrices pipeline the catalog page uses.

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode, Navigation, Mousewheel } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/free-mode';
// 'swiper/css/navigation' is deliberately not imported — its default
// .swiper-button-next/-prev styling would out-specificity the Tailwind
// classes on NavButton below; the Navigation module's click-to-advance
// behavior only needs the class names, not the stylesheet.
//
// Never override .swiper's own `overflow: hidden` (e.g. an
// `overflow-visible!` className) — that's what clips slides to the visible
// carousel width; without it slides bleed past the viewport and grow the
// whole page a horizontal scrollbar.
import ProductCard from '@/components/features/catalog/ProductCard';
import { useLiveCatalogPrices } from '@/hooks/catalog/useLiveCatalogPrices';
import { useCrossStoreStockCodes } from '@/hooks/catalog/useCrossStoreStockCodes';
import { useRecentlyViewedItems } from '@/hooks/products/useRecentlyViewed';

// swiper-button-prev/-next class names are how the Navigation module wires
// click handlers — required even though the visual styling here is all
// Tailwind, not Swiper's CSS.
function NavButton({ direction }) {
  const isPrev = direction === 'prev';
  return (
    <button
      type="button"
      aria-label={isPrev ? 'Previous' : 'Next'}
      className={[
        isPrev ? 'swiper-button-prev' : 'swiper-button-next',
        'after:hidden', // hide Swiper's default arrow-glyph pseudo-element — using lucide icons instead
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

  const { priceById, settledIds } = useLiveCatalogPrices(items);

  // Real cross-store stock, not the has_stock snapshot stored on the item
  // at view time (stale as soon as the operator switches stores).
  const itemIds = useMemo(() => items.map((i) => i.item_id), [items]);
  const { stockByItemId, isLoading: stockLoading } = useCrossStoreStockCodes(itemIds);

  if (items.length === 0) return null;

  return (
    <section className="relative flex flex-col gap-4">
      <h2 className="font-heading text-lg text-foreground">Recently Viewed</h2>

      <div className="group/carousel relative -mx-4 px-4 md:-mx-6 md:px-6">
        <Swiper
          modules={[FreeMode, Navigation, Mousewheel]}
          freeMode
          navigation={{ prevEl: '.swiper-button-prev', nextEl: '.swiper-button-next' }}
          // Enables trackpad/mouse-wheel swiping on desktop; forceToAxis
          // keeps a normal vertical page scroll from being hijacked.
          mousewheel={{ forceToAxis: true }}
          // 1.5 on mobile is deliberate: a half-visible card signals "swipe
          // for more" — a clean 1 looks like a single full-width banner.
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
                {/* showStockBadge is withheld while stock is still loading,
                    to avoid flashing the item's stale stored has_stock. */}
                <ProductCard
                  product={{ ...item, price, is_pricing: isPricing }}
                  showStockBadge={!stockLoading}
                  realStock={stockByItemId.get(item.item_id) ?? null}
                />
              </SwiperSlide>
            );
          })}
        </Swiper>

        {/* z-10 is required: Swiper's own base CSS gives .swiper
            position:relative;z-index:1, which otherwise paints on top of
            these arrow divs despite them coming later in the DOM. */}
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
