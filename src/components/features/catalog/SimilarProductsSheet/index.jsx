'use client';

// "View Similar" sheet — triggered from a small icon on ProductCard itself
// (see that component's own header). Deliberately a BOTTOM sheet on every
// width (BottomSheet's `alwaysBottom`), not the usual side-drawer-on-tablet+
// convention every other sheet in this app uses — explicit product
// requirement, so a quick "what else is like this" glance never covers more
// than the bottom portion of the screen, even on desktop.
//
// Reuses the exact same OrnaVerse-only matching pipeline as
// SimilarProductsCarousel (the product detail page's own "Similar
// Products" shelf) — see hooks/products/useSimilarProducts.js for why
// there's no Shopify involved and how the match is decided. Rendered as a
// grid here (not a carousel) since the sheet has real vertical room and no
// need for swipe navigation. Grid columns (2/3/3/4/5) intentionally mirror
// ProductGrid's own catalog-page layout 1:1, including the 5-up desktop
// breakpoint, so this reads as "the catalog page, filtered" rather than a
// visually distinct mini-layout.
//
// `items` arrives pre-computed from ProductCard (which already needs the
// match list itself, to decide whether to show the "View Similar" icon at
// all — see that component's own header) rather than being recomputed
// here from `product`+`storeId`; this component only adds what genuinely
// depends on being open: live pricing and cross-store stock, gated below
// so a closed (or never-opened) card never pays for either.
//
// ProductCard → SimilarProductsSheet → ProductCard is a real import cycle,
// left in deliberately rather than duplicating the card markup: neither
// side touches the other at module-evaluation time (both are plain
// function components referencing each other only inside JSX), which
// Next's bundler resolves correctly — confirmed via a real build.
//
// The cards rendered here pass showSimilarIcon={false} — a "view similar
// of this similar item" nested sheet-on-a-sheet is confusing on its own,
// on top of which every card in here is one level deep in a cycle that
// doesn't need a second one opening beneath it.
//
// similarProductsSurface="sheet" — tapping a card here to navigate fires
// EVENTS.SIMILAR_PRODUCT_CLICKED (see ProductCard's own header); the
// "viewed" half of the pair fires where the icon that opens this sheet is
// clicked (ProductCard's icon onClick), not duplicated here.

import ProductCard from '@/components/features/catalog/ProductCard';
import BottomSheet from '@/components/shared/BottomSheet';
import EmptyState from '@/components/shared/EmptyState';
import { PackageSearch } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useLiveCatalogPrices } from '@/hooks/catalog/useLiveCatalogPrices';
import { useCrossStoreStockCodes } from '@/hooks/catalog/useCrossStoreStockCodes';

function SimilarProductsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   items: object[],
 *   isLoading?: boolean,
 * }} props
 *   items — the matched ProductCatalogRow list from ProductCard's own
 *   useSimilarProducts call.
 *   isLoading (default false) — true while the tenant-wide catalog sweep
 *   that useSimilarProducts matches against is still resolving. FIXED
 *   2026-09-18 (reported: "View Similar icon takes minutes to appear"):
 *   ProductCard now shows this icon immediately on every card and only
 *   triggers/reads that sweep once the sheet actually opens (see
 *   ProductCard's own comment), instead of pre-computing matches for every
 *   card just to decide whether the icon should exist — so `items` can
 *   genuinely still be empty-because-loading here, not just
 *   empty-because-no-match, and those two states need to read differently.
 */
export default function SimilarProductsSheet({ isOpen, onClose, items, isLoading = false }) {
  // Only price/stock-check while genuinely open — a list nobody is
  // looking at yet shouldn't pay for either.
  const effectiveItems = isOpen ? items : [];

  const { priceById, settledIds } = useLiveCatalogPrices(effectiveItems);
  const itemIds = effectiveItems.map((i) => i.item_id);
  const { stockByItemId, isLoading: stockLoading } = useCrossStoreStockCodes(itemIds);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Similar Products" alwaysBottom>
      {isLoading && items.length === 0 ? (
        <SimilarProductsSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="No similar products found"
          description="This item doesn't have a close match in the current catalog."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => {
            const price = priceById.get(item.item_id) ?? null;
            const isPricing = price == null && !settledIds.has(item.item_id);
            return (
              <ProductCard
                key={item.item_id}
                product={{ ...item, price, is_pricing: isPricing }}
                showStockBadge={!stockLoading}
                realStock={stockByItemId.get(item.item_id) ?? null}
                showSimilarIcon={false}
                similarProductsSurface="sheet"
              />
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}
