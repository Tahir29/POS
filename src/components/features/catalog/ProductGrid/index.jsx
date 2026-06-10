'use client';

// src/components/features/catalog/ProductGrid/index.jsx
//
// Renders the product grid with automatic infinite scroll.
// Uses IntersectionObserver on a sentinel div at the bottom —
// when it enters the viewport, onLoadMore is called automatically.
// No "Load More" button needed.

import { useEffect, useRef } from 'react';
import ProductCard    from '@/components/features/catalog/ProductCard';
import CatalogSkeleton from '@/components/features/catalog/CatalogSkeleton';

// ── Empty state ───────────────────────────────────────────────────────────────

function CatalogEmptyState({ hasFilters, onClearFilters }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
        <svg
          className="h-8 w-8 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
      </div>
      <p className="text-base font-semibold text-foreground">
        {hasFilters ? 'No products match your filters' : 'No products found'}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasFilters
          ? 'Try adjusting or clearing your filters.'
          : 'This store has no products in the catalog yet.'}
      </p>
      {hasFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="
            mt-5 min-h-[44px] rounded-xl bg-primary px-5 py-2.5
            text-sm font-semibold text-primary-foreground
            hover:bg-primary/90 transition-colors
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          "
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

// ── Fetch more spinner ────────────────────────────────────────────────────────

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

// ── ProductGrid ───────────────────────────────────────────────────────────────

/**
 * @param {{
 *   products:       object[],
 *   isLoading:      boolean,
 *   isFetchingMore: boolean,
 *   hasMore:        boolean,
 *   hasFilters:     boolean,
 *   onLoadMore:     () => void,
 *   onClearFilters: () => void,
 * }} props
 */
export default function ProductGrid({
  products       = [],
  isLoading,
  isFetchingMore,
  hasMore,
  hasFilters,
  onLoadMore,
  onClearFilters,
}) {
  const sentinelRef = useRef(null);

  // Intersection Observer — auto-triggers onLoadMore when sentinel is visible
  useEffect(() => {
    if (!hasMore || isFetchingMore) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: '200px' }, // trigger 200px before hitting bottom
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
      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.map((product) => (
          <ProductCard
            key={product.item_id ?? product.item_code}
            product={product}
          />
        ))}
      </div>

      {/* Sentinel — invisible div that triggers next page load */}
      {hasMore && (
        <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />
      )}

      {/* Fetching spinner */}
      {isFetchingMore && <FetchingSpinner />}

      {/* End of catalog */}
      {!hasMore && products.length > 0 && (
        <p className="py-6 text-center text-xs text-muted-foreground">
          All {products.length} products loaded
        </p>
      )}
    </div>
  );
}
