'use client';

// src/components/features/catalog/ProductGrid/index.jsx
// Renders the product catalog grid.
// Handles: loading (skeleton), empty state, product cards, load-more pagination.
// Receives products + pagination state from CatalogPage — no data fetching here.

import ProductCard from '@/components/features/catalog/ProductCard';
import CatalogSkeleton from '@/components/features/catalog/CatalogSkeleton';

// ── Empty State ───────────────────────────────────────────────────────────────

function CatalogEmptyState({ hasFilters, onClearFilters }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {/* Icon */}
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100">
        <svg
          className="h-8 w-8 text-stone-400"
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

      <p className="text-base font-semibold text-stone-700">
        {hasFilters ? 'No products match your filters' : 'No products found'}
      </p>
      <p className="mt-1 text-sm text-stone-400">
        {hasFilters
          ? 'Try adjusting or clearing your filters.'
          : 'This store has no products in the catalog yet.'}
      </p>

      {hasFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-5 min-h-11 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-700 active:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

// ── Load More Button ──────────────────────────────────────────────────────────

function LoadMoreButton({ onClick, isLoading }) {
  return (
    <div className="flex justify-center pt-6 pb-4">
      <button
        type="button"
        onClick={onClick}
        disabled={isLoading}
        className="min-h-11 min-w-[140px] rounded-lg border border-stone-200 bg-white px-6 py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition-colors hover:bg-stone-50 active:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg
              className="h-4 w-4 animate-spin text-stone-400"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Loading…
          </span>
        ) : (
          'Load more'
        )}
      </button>
    </div>
  );
}

// ── ProductGrid ───────────────────────────────────────────────────────────────

/**
 * @param {{
 *   products: object[],
 *   isLoading: boolean,
 *   isFetchingMore: boolean,
 *   hasMore: boolean,
 *   hasFilters: boolean,
 *   onLoadMore: () => void,
 *   onClearFilters: () => void,
 * }} props
 */
export default function ProductGrid({
  products = [],
  isLoading,
  isFetchingMore,
  hasMore,
  hasFilters,
  onLoadMore,
  onClearFilters,
}) {
  // Initial load — show full skeleton
  if (isLoading) {
    return <CatalogSkeleton />;
  }

  // No products after load
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
      {/* Product grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.map((product) => (
          <ProductCard
            key={product.item_id ?? product.item_code}
            product={product}
          />
        ))}
      </div>

      {/* Pagination — load more */}
      {hasMore && (
        <LoadMoreButton onClick={onLoadMore} isLoading={isFetchingMore} />
      )}
    </div>
  );
}
