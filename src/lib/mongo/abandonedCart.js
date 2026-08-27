// src/lib/mongo/abandonedCart.js
//
// Per-customer "abandoned cart" snapshot, keyed by party_id — one document
// per customer (unlike recentlyViewed.js, which keeps a growing list; a
// cart isn't a history, it's whatever is CURRENTLY sitting unpaid). Every
// upsert replaces the whole snapshot — the latest write always wins.
//
// LIFECYCLE (see store/abandonedCartMiddleware.js for the triggers):
//   - Saved whenever the cart changes (debounced) while a customer is
//     attached, and again right after attaching if items carried over
//     from a customer switch ("Keep Cart" — see CustomerSessionSheet).
//   - Deleted the moment the cart clears for ANY reason — a completed
//     sale or a manual "Clear Cart" both fire the same cart/clearCart
//     action, and either way there's nothing left to call abandoned.
//   - Fetched on attach; if the customer has one AND the live cart is
//     currently empty, it's restored straight into the cart.
//
// Same trust boundary as customers/recently-viewed.js: the route calling
// this requires the caller's own OrnaVerse bearer token, so only an
// authenticated operator can read/write anything, and only against a
// party_id they can already see through the app's normal flows. No price
// is re-verified against OrnaVerse here — same reasoning as recently-
// viewed's snapshot: this is for restoring what was in the cart and for
// marketing visibility into abandoned carts, not a financial record: the
// real price is always re-derived live when (if) the sale is completed.

import { getDb } from './client';

// _POS suffix (2026-08-27) — see wishlist.js's identical comment; same
// live rename (3 docs before and after, confirmed), same reasoning.
const COLLECTION = 'abandonedCarts_POS';

/**
 * @param {{ party_id: number, customerName?: string, customerMobile?: string,
 *   items: object[], subtotal?: number, taxAmount?: number, total?: number,
 *   company_id?: number }} params
 */
export async function upsertAbandonedCart({ party_id, customerName, customerMobile, items, subtotal, taxAmount, total, company_id }) {
  const db = await getDb();
  await db.collection(COLLECTION).updateOne(
    { party_id },
    {
      $set: {
        party_id,
        customerName:  customerName  ?? null,
        customerMobile: customerMobile ?? null,
        items,
        subtotal:  subtotal  ?? null,
        taxAmount: taxAmount ?? null,
        total:     total     ?? null,
        // Which store was active when this snapshot was saved (2026-08-27)
        // — tagged on so the cart data carries its store instead of losing
        // it; not used to scope the lookup, still keyed on party_id alone.
        company_id: company_id ?? null,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
}

/**
 * @param {number} partyId
 * @returns {Promise<object|null>}
 */
export async function getAbandonedCart(partyId) {
  const db = await getDb();
  return db.collection(COLLECTION).findOne({ party_id: partyId });
}

/**
 * Called once the cart is no longer pending — a completed sale or a
 * manual clear (see the middleware's cart/clearCart case).
 * @param {number} partyId
 */
export async function deleteAbandonedCart(partyId) {
  const db = await getDb();
  await db.collection(COLLECTION).deleteOne({ party_id: partyId });
}
