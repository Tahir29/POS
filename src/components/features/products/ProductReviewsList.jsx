'use client';

// Customer reviews section for the bottom of the product detail page.
//
// Bounded on the page itself (2026-07-26 revamp) — a product with 100+
// reviews used to append them all inline via infinite scroll, growing the
// page length unbounded. Now only a small preview shows inline; "View all"
// opens the full paginated list inside a BottomSheet, whose body is a
// fixed-height scrollable container — so the page's own length never grows
// no matter how many reviews a product has.

import { useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import StarRating from '@/components/shared/StarRating';
import { Skeleton } from '@/components/ui/skeleton';
import BottomSheet from '@/components/shared/BottomSheet';
import { useProductReviews } from '@/hooks/products/useProductReviews';
import { useProductReviewSummary } from '@/hooks/products/useProductReviewSummary';

const PREVIEW_COUNT = 3;

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

function ReviewsSkeleton({ count = PREVIEW_COUNT }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border p-4 flex flex-col gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/**
 * @param {{ shopifyProductId: string|number|null }} props
 */
export default function ProductReviewsList({ shopifyProductId }) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const { average, count, isLoading: summaryLoading } = useProductReviewSummary(shopifyProductId);
  const {
    reviews, isLoading, isFetchingMore, hasMore, loadMore,
  } = useProductReviews(shopifyProductId);

  // No Shopify link for this product at all — nothing to show, no error.
  if (!shopifyProductId) return null;

  // Still resolving the summary — hold off rendering anything (including
  // the title) until we actually know whether this product has reviews,
  // rather than flashing the section in and then hiding it.
  if (summaryLoading) return null;

  // Resolved, genuinely zero reviews — hide the entire section, title included.
  if (count === 0) return null;

  const previewReviews = reviews.slice(0, PREVIEW_COUNT);
  const hasMoreThanPreview = count > PREVIEW_COUNT;

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
          {previewReviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}

      {!isLoading && hasMoreThanPreview && (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="self-start text-sm font-semibold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          View all {count.toLocaleString('en-IN')} reviews
        </button>
      )}

      {/* Full list — fixed-height scrollable sheet, not more inline page
          content, so the page's own length stays constant regardless of
          how many reviews load ("Load more" here, not auto-infinite-scroll,
          since the sheet body isn't the window and doesn't need to be). */}
      <BottomSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={`Customer Reviews (${count.toLocaleString('en-IN')})`}
      >
        <div className="flex flex-col gap-3">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
        {hasMore && (
          <div className="flex justify-center pt-4">
            <button
              type="button"
              onClick={loadMore}
              disabled={isFetchingMore}
              className="text-sm font-semibold text-accent hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              {isFetchingMore ? 'Loading…' : 'Load more reviews'}
            </button>
          </div>
        )}
      </BottomSheet>
    </section>
  );
}
