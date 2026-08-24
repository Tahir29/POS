'use client';

// Renders the product grid with automatic infinite scroll.
// Uses IntersectionObserver on a sentinel div at the bottom —
// when it enters the viewport, onLoadMore is called automatically.
// No "Load More" button needed.

import { useEffect, useRef } from 'react';
import { PackageSearch } from 'lucide-react';
import ProductCard     from '@/components/features/catalog/ProductCard';
import CatalogSkeleton from '@/components/features/catalog/CatalogSkeleton';
import EmptyState      from '@/components/shared/EmptyState';
import { Button }      from '@/components/ui/button';

// Delegates to the shared EmptyState (same card/badge/icon convention used
// everywhere else) instead of a one-off hand-rolled version — this was the
// only catalog-specific empty state left over from before that convention existed.

function CatalogEmptyState({ hasFilters, onClearFilters }) {
  return (
    <EmptyState
      className="py-20"
      icon={PackageSearch}
      title={hasFilters ? 'No products match your filters' : 'No products found'}
      description={
        hasFilters
          ? 'Try adjusting or clearing your filters.'
          : 'This store has no products in the catalog yet.'
      }
      action={
        hasFilters && (
          <Button type="button" onClick={onClearFilters}>
            Clear filters
          </Button>
        )
      }
    />
  );
}

function FetchingSpinner() {
  return (
    <div className="flex justify-center py-6" aria-label="Loading more products">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <svg
          className="h-4 w-4 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading more…
      </div>
    </div>
  );
}

/**
 * @param {{
 *   products:        object[],
 *   isLoading:       boolean,
 *   isFetchingMore:  boolean,
 *   hasMore:         boolean,
 *   hasFilters:      boolean,
 *   showStockBadge:  boolean,
 *   onLoadMore:      () => void,
 *   onClearFilters:  () => void,
 * }} props
 */
export default function ProductGrid({
  products       = [],
  isLoading,
  isFetchingMore,
  hasMore,
  hasFilters,
  showStockBadge = false,
  onLoadMore,
  onClearFilters,
}) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!hasMore || isFetchingMore) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onLoadMore();
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isFetchingMore, onLoadMore]);

  if (isLoading) return <CatalogSkeleton />;

  if (!products.length) {
    return (
      <CatalogEmptyState
        hasFilters={hasFilters}
        onClearFilters={onClearFilters}
      />
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.map((product) => (
          <ProductCard
            key={product.item_id ?? product.item_code}
            product={product}
            showStockBadge={showStockBadge}
          />
        ))}
      </div>

      {/* Sentinel — triggers next page load */}
      {hasMore && (
        <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />
      )}

      {isFetchingMore && <FetchingSpinner />}

      {!hasMore && products.length > 0 && (
        <p className="py-6 text-center text-xs text-muted-foreground">
          All {products.length} products loaded
        </p>
      )}
    </div>
  );
}