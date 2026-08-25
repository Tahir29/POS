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
 *
 * The $pull below matches on (item_id, item_size_id) TOGETHER, not item_id
 * alone (2026-08-24 fix) — an item's real identity here is that pair: the
 * bare base design (item_size_id null) and "item_id X, Size 7 confirmed via
 * Customize" are different things a customer can each independently want.
 * Matching on item_id alone meant wishlisting one variant silently deleted
 * and replaced whichever OTHER variant of that same item_id was already
 * saved, instead of the two coexisting as separate entries.
 * @param {{ party_id: number, customerName?: string, customerMobile?: string, item: object }} params
 */
export async function addWishlistItem({ party_id, customerName, customerMobile, item }) {
  const db = await getDb();
  const coll = db.collection(COLLECTION);
  const itemSizeId = item.item_size_id ?? null;

  await coll.updateOne(
    { party_id },
    { $pull: { items: { item_id: item.item_id, item_size_id: itemSizeId } } },
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
 * item_size_id (2026-08-24) — matched together with item_id, same reasoning
 * as addWishlistItem above: without it, removing one size variant of an
 * item_id would $pull every OTHER variant of that same item_id too.
 * @param {{ party_id: number, item_id: number, item_size_id?: number|null }} params
 */
export async function removeWishlistItem({ party_id, item_id, item_size_id = null }) {
  const db = await getDb();
  await db.collection(COLLECTION).updateOne(
    { party_id },
    { $pull: { items: { item_id, item_size_id } }, $set: { updatedAt: new Date() } },
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
