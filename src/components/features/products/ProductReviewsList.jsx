'use client';

// src/components/features/products/ProductReviewsList.jsx
//
// Customer reviews section for the bottom of the product detail page.
// Infinite scroll — same IntersectionObserver-sentinel pattern as
// ProductGrid's catalog infinite scroll, no "Load more" button needed.

import { useEffect, useRef } from 'react';
import { Loader2, MessageSquareText, BadgeCheck } from 'lucide-react';
import StarRating from '@/components/shared/StarRating';
import { useProductReviews } from '@/hooks/products/useProductReviews';
import { useProductReviewSummary } from '@/hooks/products/useProductReviewSummary';

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ReviewCard({ review }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{review.name}</p>
          {review.isVerified && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-status-in-stock shrink-0">
              <BadgeCheck size={13} aria-hidden="true" />
              Verified
            </span>
          )}
        </div>
        {formatDate(review.postedAt) && (
          <p className="text-xs text-muted-foreground shrink-0">{formatDate(review.postedAt)}</p>
        )}
      </div>
      <StarRating rating={review.rating} size="sm" />
      {review.text && (
        <p className="text-sm text-muted-foreground leading-relaxed">{review.text}</p>
      )}
    </div>
  );
}

function ReviewsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-border p-4 flex flex-col gap-2">
          <div className="h-3 w-28 rounded bg-muted animate-pulse" />
          <div className="h-3 w-20 rounded bg-muted animate-pulse" />
          <div className="h-3 w-full rounded bg-muted animate-pulse" />
          <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/**
 * @param {{ shopifyProductId: string|number|null }} props
 */
export default function ProductReviewsList({ shopifyProductId }) {
  const { average, count, isLoading: summaryLoading } = useProductReviewSummary(shopifyProductId);
  const {
    reviews, isLoading, isFetchingMore, hasMore, loadMore,
  } = useProductReviews(shopifyProductId);

  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!hasMore || isFetchingMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isFetchingMore, loadMore]);

  // No Shopify link for this product at all — nothing to show, no error.
  if (!shopifyProductId) return null;

  // Resolved, but genuinely zero reviews — still show the section so it's
  // clear this isn't a loading/error state.
  if (!isLoading && !summaryLoading && count === 0) {
    return (
      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg text-foreground">Customer Reviews</h2>
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
          <MessageSquareText size={24} className="text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No reviews yet for this product.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-lg text-foreground">Customer Reviews</h2>
        {count > 0 && <StarRating rating={average} count={count} size="md" showValue />}
      </div>

      {isLoading ? (
        <ReviewsSkeleton />
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}

      {/* Infinite-scroll sentinel */}
      {hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center py-4">
          {isFetchingMore && (
            <Loader2 size={18} className="animate-spin text-muted-foreground" aria-hidden="true" />
          )}
        </div>
      )}
    </section>
  );
}
