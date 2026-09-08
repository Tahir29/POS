'use client';

// Clickable star-rating + review-count summary, shown near the top of the
// product detail page — clicking it smooth-scrolls down to the full
// "Customer Reviews" section at the bottom (see ProductReviewsList, which
// owns the #product-reviews anchor this scrolls to — the id string is
// duplicated between the two files rather than shared from an import,
// same tradeoff as any other plain DOM anchor id).
//
// Hidden entirely when the product has no reviews yet — same
// useProductReviewSummary()/count===0 gate ProductReviewsList itself uses,
// so the two always agree: never a summary here with an empty section
// below, and never a visible section below with nothing to point at from
// up here.

import StarRating from '@/components/shared/StarRating';
import { useProductReviewSummary } from '@/hooks/products/useProductReviewSummary';

/**
 * @param {{ shopifyProductId: string|number|null }} props
 */
export default function ProductReviewSummaryLink({ shopifyProductId }) {
  const { average, count, isLoading } = useProductReviewSummary(shopifyProductId);

  // No Shopify link, still loading, or genuinely zero reviews — nothing to
  // show or link to (mirrors ProductReviewsList's own three early returns).
  if (!shopifyProductId || isLoading || count === 0) return null;

  const handleClick = () => {
    document.getElementById('product-reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="self-start rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Rated ${average.toFixed(1)} out of 5 from ${count} review${count !== 1 ? 's' : ''} — jump to reviews`}
    >
      <StarRating rating={average} count={count} size="md" showValue />
    </button>
  );
}
