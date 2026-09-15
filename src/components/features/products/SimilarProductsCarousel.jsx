'use client';

// "Similar Products" strip on the product detail page. Sourced entirely
// from OrnaVerse's own ProductCatalog/List (see hooks/products/
// useSimilarProducts.js for the matching logic and why there's no Shopify
// involved) — matches by type_id/item_group_id against the same
// store-scoped catalog the catalog page and RecentlyViewedCarousel already
// share, so this costs no extra "is this thing actually similar" API call.
//
// Structurally a near-duplicate of RecentlyViewedCarousel.jsx on purpose —
// same Swiper config, same ProductCard reuse, same live-pricing/live-stock
// pipeline — so the two shelves behave identically to the operator and
// there's exactly one carousel pattern to maintain, not two.

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode, Navigation, Mousewheel } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/free-mode';
// 'swiper/css/navigation' deliberately not imported — see NavButton below.
import ProductCard from '@/components/features/catalog/ProductCard';
import { useLiveCatalogPrices } from '@/hooks/catalog/useLiveCatalogPrices';
import { useCrossStoreStockCodes } from '@/hooks/catalog/useCrossStoreStockCodes';
import { useSimilarProducts } from '@/hooks/products/useSimilarProducts';

function NavButton({ direction }) {
  const isPrev = direction === 'prev';
  return (
    <button
      type="button"
      aria-label={isPrev ? 'Previous' : 'Next'}
      className={[
        isPrev ? 'swiper-button-prev' : 'swiper-button-next',
        'after:hidden',
        'flex! h-9! w-9! items-center justify-center rounded-full border border-border',
        'bg-card text-foreground shadow-sm hover:bg-muted',
        'top-1/2! mt-0! -translate-y-1/2',
        'disabled:opacity-0!',
      ].join(' ')}
    >
      {isPrev ? <ChevronLeft size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
    </button>
  );
}

/**
 * @param {{ product: object|null, activeStoreId: number|null }} props
 *   product — the item currently on screen (its type_id/item_group_id
 *   drive the match); activeStoreId — same store useAllCatalog scopes to.
 */
export default function SimilarProductsCarousel({ product, activeStoreId }) {
  const { items } = useSimilarProducts(product, activeStoreId);

  const { priceById, settledIds } = useLiveCatalogPrices(items);

  const itemIds = items.map((i) => i.item_id);
  const { stockByItemId, isLoading: stockLoading } = useCrossStoreStockCodes(itemIds);

  // Covers both "nothing to show yet" (cold catalog cache still sweeping)
  // and "nothing to show ever" (no match at all, e.g. a one-of-a-kind
  // item_group_id) — no empty shelf, no "loading" flash for a shelf the
  // operator may not even scroll to.
  if (items.length === 0) return null;

  return (
    <section className="relative flex flex-col gap-4">
      <h2 className="font-heading text-lg text-foreground">Similar Products</h2>

      <div className="group/carousel relative -mx-4 px-4 md:-mx-6 md:px-6">
        <Swiper
          modules={[FreeMode, Navigation, Mousewheel]}
          freeMode
          navigation={{ prevEl: '.swiper-button-prev', nextEl: '.swiper-button-next' }}
          mousewheel={{ forceToAxis: true }}
          slidesPerView={1.5}
          spaceBetween={12}
          breakpoints={{
            768:  { slidesPerView: 2.5, spaceBetween: 12 },
            1024: { slidesPerView: 3.5, spaceBetween: 16 },
            1200: { slidesPerView: 5, spaceBetween: 16 },
          }}
        >
          {items.map((item) => {
            const price = priceById.get(item.item_id) ?? null;
            const isPricing = price == null && !settledIds.has(item.item_id);
            return (
              <SwiperSlide key={item.item_id}>
                <ProductCard
                  product={{ ...item, price, is_pricing: isPricing }}
                  showStockBadge={!stockLoading}
                  realStock={stockByItemId.get(item.item_id) ?? null}
                />
              </SwiperSlide>
            );
          })}
        </Swiper>

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
