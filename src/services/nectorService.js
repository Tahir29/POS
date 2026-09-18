// Client-side service for Nector product reviews + loyalty points.
// Calls our own /api/nector proxy — never Nector directly — so the API key
// never reaches the browser. See src/app/api/nector/[...path]/route.js for
// the confirmed response shapes (Nector's own docs don't specify them).
//
// Every function here is fail-safe: none of them throw, all return safe
// empty defaults on any error, so a Nector outage never breaks whatever
// screen is asking for reviews or points around it.

import { createConcurrencyQueue } from '@/lib/concurrencyQueue';

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
 * Same call, routed through a shared concurrency-capped queue — the catalog
 * grid isn't virtualized, so every mounted ProductCard calls this
 * independently (via useProductReviewSummary) once its style resolves.
 * Confirmed live 2026-09-18: ~100 simultaneous reviews-count requests
 * compounds with the same-shaped Style/Retrieve flood (see
 * getDesignVariantsQueued in itemService.js) to produce the multi-minute
 * delay before a catalog card's rating badge appears.
 */
export const getReviewSummaryQueued = createConcurrencyQueue(getReviewSummary, { concurrency: 6 });

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

/**
 * A customer's Nector loyalty points balance, looked up by mobile number —
 * Nector's own term for a customer record is a "lead".
 *
 * 200 → { data: { item: { available: "500" (string!), tier, name,
 *   wallet: { available, ... }, ... } } } — a real Nector lead exists.
 * 422 → { data: { message: "Lead does not exists" } } — NOT an error to
 *   report; a customer who's simply never interacted with the Shopify
 *   storefront (never earned a Nector lead record) is the normal case for
 *   most in-store-only customers. `found: false` lets a caller show "not
 *   enrolled" instead of a scary error state.
 *
 * @param {string|number} mobile — real, UNMASKED mobile number (the same one
 *   this app already has via useCustomerSession().customerMobile)
 * @returns {Promise<{ found: boolean, points: number, tier: string|null, name: string|null }>}
 */
export async function getCustomerLoyalty(mobile) {
  const empty = { found: false, points: 0, tier: null, name: null };
  if (!mobile) return empty;

  try {
    const params = new URLSearchParams({ mobile: String(mobile) });
    const res = await fetch(`/api/nector/leads?${params}`);
    if (!res.ok) return empty; // 422 "Lead does not exists", or any other failure

    const json = await res.json();
    const item = json?.data?.item;
    if (!item) return empty;

    return {
      found:  true,
      // "available" comes back as a numeric STRING ("500"), not a number —
      // confirmed live, not a typo to "fix" here.
      points: Number(item.available) || 0,
      tier:   item.tier ?? null,
      name:   item.name ?? null,
    };
  } catch (err) {
    console.warn('[nectorService] getCustomerLoyalty failed:', err);
    return empty;
  }
}

/**
 * Debits (redeems) Lucira Coins from a customer's Nector wallet. Fires AFTER
 * a real POS sale has already completed; a failure here never blocks or
 * reverses that sale.
 *
 * BEST-EFFORT, NOT CONFIRMED WORKING — Nector's debit endpoint needs a
 * lead's own `_id` (or a merchant-assigned `customer_id`, which this app has
 * never set — these leads were created by Nector's own Shopify storefront
 * app). The mobile-based lookup this function re-runs to find the lead
 * doesn't return either field in its response body. Sends `mid` as `lead_id`
 * as the closest available candidate (a per-lead value, unlike entity_id
 * which is shared across different leads) — this is a genuine guess,
 * expected to fail until Nector support clarifies how to get a lead's real
 * `_id` from a mobile lookup.
 *
 * @param {{ mobile: string, amount: number, title: string, description?: string }} params
 * @returns {Promise<{ ok: boolean, reason?: string }>} — never throws;
 *   caller decides what (if anything) to do with a failure (checkout logs
 *   it and moves on, it does not surface as an error to the operator).
 */
export async function redeemLoyaltyCoins({ mobile, amount, title, description }) {
  if (!mobile || !(amount > 0)) return { ok: false, reason: 'invalid_params' };

  try {
    // Re-look-up the lead for its `mid` — see this function's own header for
    // why that's the best candidate identifier available, not a
    // confirmed-correct one.
    const lookupParams = new URLSearchParams({ mobile: String(mobile) });
    const lookupRes = await fetch(`/api/nector/leads?${lookupParams}`);
    if (!lookupRes.ok) return { ok: false, reason: 'lead_not_found' };

    const lookupJson = await lookupRes.json();
    const mid = lookupJson?.data?.item?.mid;
    if (!mid) return { ok: false, reason: 'no_lead_id' };

    // Same-origin call — the operator's session cookie rides along
    // automatically; the route itself rejects with 401 if no one's signed in.
    const res = await fetch('/api/nector/wallettransactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id:     mid,
        amount,
        operation:   'dr',
        title:       title || 'POS Redemption',
        description: description ?? undefined,
      }),
    });

    if (!res.ok) return { ok: false, reason: res.status === 401 ? 'not_authenticated' : `http_${res.status}` };
    return { ok: true };
  } catch (err) {
    console.warn('[nectorService] redeemLoyaltyCoins failed:', err);
    return { ok: false, reason: 'network_error' };
  }
}
