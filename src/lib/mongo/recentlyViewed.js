// src/lib/mongo/recentlyViewed.js
//
// Per-customer "recently viewed" list — separate collection from
// customers/customerProfile.js on purpose: this is app-generated browsing
// behaviour, not a mirror of an OrnaVerse record, so it doesn't belong
// inside that document (and its own lifecycle — capped, reordered on every
// view — is nothing like a profile upsert).
//
// KEYED BY MOBILE, NOT party_id (FIXED 2026-09-09) — see
// lib/mongo/normalizeMobile.js's own header for the full root-cause,
// discovered via a report that abandoned-cart restore silently failed on
// LIVE (this file shares the identical party_id-keyed design abandonedCart.js
// had, and almost certainly has the same defect — it just fails invisibly:
// an empty carousel renders nothing and reads as "no history yet," not as a
// bug). mobileKey (normalizeMobileKey(customerMobile)) is the primary lookup
// now; party_id stays stored on the record as an informational field, same
// as before, just no longer what a read is filtered by. Falls back to
// party_id-only filtering when a normalizable mobile genuinely isn't
// available.
//
// Unlike customerProfile.js, the item snapshot stored here is NOT re-fetched
// from an authoritative source before writing. It's a deliberately light,
// client-supplied snapshot (name/image/karat/weight — see
// recentlyViewedSchema.js for the exact shape) taken at view time, purely
// for instant carousel rendering; nothing here is trusted for pricing or
// stock decisions. Price is never stored — the carousel re-prices live via
// the same useLiveCatalogPrices pipeline the catalog page uses, exactly
// because a stored price would go stale (see that hook's own header for why
// this app never treats a snapshot price as current). The trust boundary
// that matters here is the same one customers/sync relies on: the route
// calling this requires the caller's own OrnaVerse bearer token, so only an
// authenticated operator can write anything at all, and only against a
// customer they can already see through the app's normal flows.

import { getDb } from './client';
import { normalizeMobileKey } from './normalizeMobile';

// _POS suffix (2026-08-27) — see wishlist.js's identical comment; same
// live rename (5 docs before and after, confirmed), same reasoning.
const COLLECTION = 'recentlyViewed_POS';

// Mirrors MAX_ITEMS in store/slices/recentlyViewedSlice.js — keep the two
// in sync manually if either changes; there's no shared import between a
// server-only Mongo module and a client-safe Redux slice.
const MAX_ITEMS = 20;

/**
 * Builds the filter a read/write should use — mobile-keyed when possible,
 * falling back to party_id alone otherwise. Shared so the two updateOne
 * calls in upsertRecentlyViewedItem and getRecentlyViewedItems can never
 * drift into using different keys for the "same" customer.
 */
function buildFilter(partyId, customerMobile) {
  const mobileKey = normalizeMobileKey(customerMobile);
  return mobileKey ? { mobileKey } : { party_id: partyId };
}

/**
 * Records one product view, moving it to the front if already present.
 * @param {{ party_id: number, customerName?: string, customerMobile?: string, item: object }} params
 */
export async function upsertRecentlyViewedItem({ party_id, customerName, customerMobile, item }) {
  const db = await getDb();
  const coll = db.collection(COLLECTION);
  const filter = buildFilter(party_id, customerMobile);
  const mobileKey = normalizeMobileKey(customerMobile);

  // Two updates because a single MongoDB update can't $pull and $push the
  // same array path in one operation. Low-volume, fire-and-forget write —
  // the small extra round trip is not worth the complexity of a single
  // aggregation-pipeline update for this.
  await coll.updateOne(
    filter,
    { $pull: { items: { item_id: item.item_id } } },
  );

  await coll.updateOne(
    filter,
    {
      $set: {
        mobileKey,
        party_id,
        customerName: customerName ?? null,
        customerMobile: customerMobile ?? null,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
      $push: {
        items: {
          $each: [{ ...item, viewedAt: new Date() }],
          $position: 0,
          $slice: MAX_ITEMS,
        },
      },
    },
    { upsert: true },
  );
}

/**
 * @param {{ partyId: number, customerMobile?: string }} params
 * @returns {Promise<object[]>} most-recently-viewed first, capped at MAX_ITEMS
 */
export async function getRecentlyViewedItems({ partyId, customerMobile }) {
  const db = await getDb();
  const doc = await db.collection(COLLECTION).findOne(buildFilter(partyId, customerMobile));
  return doc?.items ?? [];
}
