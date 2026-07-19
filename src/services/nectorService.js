// src/services/nectorService.js
//
// Client-side service for Nector product reviews.
// Calls our own /api/nector proxy — never Nector directly — so the API key
// never reaches the browser. See src/app/api/nector/[...path]/route.js for
// the confirmed response shapes (Nector's own docs don't specify them).
//
// Both functions are fail-safe: they never throw, returning safe empty
// defaults on any error so a reviews outage never breaks the catalog or
// product page around it.

const SOURCE = 'shopify';

/**
 * Rating summary for one product — used for catalog card stars and the
 * product detail page's reviews header.
 * @param {string|number} shopifyProductId
 * @returns {Promise<{ count: number, sum: number }>}
 */
export async function getReviewSummary(shopifyProductId) {
  if (!shopifyProductId) return { count: 0, sum: 0 };

  try {
    const params = new URLSearchParams({
      reference_product_source: SOURCE,
      reference_product_id:     String(shopifyProductId),
    });
    const res = await fetch(`/api/nector/reviews-count?${params}`);
    if (!res.ok) return { count: 0, sum: 0 };

    const json = await res.json();
    const countsum = json?.data?.countsum;
    return {
      count: countsum?.count ?? 0,
      sum:   countsum?.sum   ?? 0,
    };
  } catch (err) {
    console.warn('[nectorService] getReviewSummary failed:', err);
    return { count: 0, sum: 0 };
  }
}

/**
 * One page of approved reviews for a product, newest first.
 * @param {{ shopifyProductId: string|number, page?: number, limit?: number }} params
 * @returns {Promise<{ items: object[], count: number, hasNext: boolean }>}
 */
export async function getReviews({ shopifyProductId, page = 1, limit = 10 }) {
  if (!shopifyProductId) return { items: [], count: 0, hasNext: false };

  try {
    const params = new URLSearchParams({
      reference_product_source: SOURCE,
      reference_product_id:     String(shopifyProductId),
      is_approved:               'true',
      page:                      String(page),
      limit:                     String(limit),
      sort:                      'posted_at',
      sort_op:                   'DESC',
    });
    const res = await fetch(`/api/nector/reviews?${params}`);
    if (!res.ok) return { items: [], count: 0, hasNext: false };

    const json = await res.json();
    const data = json?.data ?? {};
    return {
      items:   Array.isArray(data.items) ? data.items : [],
      count:   data.count ?? 0,
      hasNext: data.cursor?.has_next ?? false,
    };
  } catch (err) {
    console.warn('[nectorService] getReviews failed:', err);
    return { items: [], count: 0, hasNext: false };
  }
}
