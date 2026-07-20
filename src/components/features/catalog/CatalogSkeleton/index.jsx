'use client';

// src/components/features/catalog/CatalogSkeleton/index.jsx
// Loading skeleton for the product grid.
// Renders N placeholder cards that match ProductCard proportions.
// Shown while useCatalogProducts is in loading state.

import { Skeleton } from '@/components/ui/skeleton';

const SKELETON_COUNT = 12;

function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-stone-100 bg-white shadow-sm">
      {/* Image placeholder */}
      <Skeleton className="aspect-square w-full rounded-none" />
      {/* Text lines */}
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="mt-2 h-4 w-20" />
      </div>
    </div>
  );
}

/**
 * @param {{ count?: number }} props
 */
export default function CatalogSkeleton({ count = SKELETON_COUNT }) {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      aria-busy="true"
      aria-label="Loading products"
    >
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
