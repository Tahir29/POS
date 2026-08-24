// src/lib/mongo/wishlist.js
//
// Per-customer wishlist, keyed by party_id — a growing list a customer
// explicitly curates (add/remove), unlike recentlyViewed.js's automatic
// history or abandonedCart.js's single current-cart snapshot. Closest in
// shape to recentlyViewed: one document per customer, items array, newest
// addition first.
//
// Same trust boundary as the other two: the route calling this requires
// the caller's own OrnaVerse bearer token, so only an authenticated
// operator can write anything, and only against a party_id they can
// already see through the app's normal flows. The item snapshot is
// whatever ProductCard already had in hand when the heart was tapped — not
// re-verified against OrnaVerse, same reasoning as recentlyViewed's
// snapshot (this is for display/marketing, not a financial record).

import { getDb } from './client';

const COLLECTION = 'wishlist';

// Generous — this is a deliberate, one-at-a-time customer action, not an
// automatic tracker, so it doesn't need recentlyViewed's tight MAX_ITEMS=20
// cap. Still bounded so nothing grows truly unbounded.
const MAX_ITEMS = 200;

/**
 * Adds one item, moving it to the front if already present (matches
 * recentlyViewed's "most recent first" convention for consistency, even
 * though recency is less central to a wishlist than a view history).
 * @param {{ party_id: number, customerName?: string, customerMobile?: string, item: object }} params
 */
export async function addWishlistItem({ party_id, customerName, customerMobile, item }) {
  const db = await getDb();
  const coll = db.collection(COLLECTION);

  await coll.updateOne(
    { party_id },
    { $pull: { items: { item_id: item.item_id } } },
  );

  await coll.updateOne(
    { party_id },
    {
      $set: { party_id, customerName: customerName ?? null, customerMobile: customerMobile ?? null, updatedAt: new Date() },
      $setOnInsert: { createdAt: new Date() },
      $push: {
        items: {
          $each: [{ ...item, addedAt: new Date() }],
          $position: 0,
          $slice: MAX_ITEMS,
        },
      },
    },
    { upsert: true },
  );
}

/**
 * @param {{ party_id: number, item_id: number }} params
 */
export async function removeWishlistItem({ party_id, item_id }) {
  const db = await getDb();
  await db.collection(COLLECTION).updateOne(
    { party_id },
    { $pull: { items: { item_id } }, $set: { updatedAt: new Date() } },
  );
}

/**
 * @param {number} partyId
 * @returns {Promise<object[]>} most-recently-added first
 */
export async function getWishlist(partyId) {
  const db = await getDb();
  const doc = await db.collection(COLLECTION).findOne({ party_id: partyId });
  return doc?.items ?? [];
}
