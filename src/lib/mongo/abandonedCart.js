// src/lib/mongo/abandonedCart.js
//
// Per-customer "abandoned cart" snapshot — one document per customer
// (unlike recentlyViewed.js, which keeps a growing list; a cart isn't a
// history, it's whatever is CURRENTLY sitting unpaid). Every upsert
// replaces the whole snapshot — the latest write always wins.
//
// KEYED BY MOBILE, NOT party_id (FIXED 2026-09-09) — see
// lib/mongo/normalizeMobile.js's own header for the full root-cause: this
// used to be keyed purely by party_id, which is assigned per OrnaVerse
// TENANT, so the same real customer resolves to a DIFFERENT party_id under
// UAT vs LIVE — confirmed live as the reason a cart saved under one
// environment silently stopped restoring after switching to the other.
// mobileKey (normalizeMobileKey(customerMobile)) is the primary lookup now;
// party_id/company_id stay stored on the record as informational fields,
// same as before, just no longer what a read is filtered by. Falls back to
// party_id-only filtering when a normalizable mobile genuinely isn't
// available (should be rare — every customer this app attaches came from a
// mobile-number lookup in the first place) so that edge case degrades to
// the OLD behaviour rather than failing outright.
//
// LIFECYCLE (see store/abandonedCartMiddleware.js for the triggers):
//   - Saved whenever the cart changes (debounced) while a customer is
//     attached, and again right after attaching if items carried over
//     from a customer switch ("Keep Cart" — see CustomerSessionSheet).
//   - Deleted the moment the cart clears for ANY reason — a completed
//     sale (cart/clearCartKeepCustomer, added 2026-09-07 so the customer
//     stays attached post-sale — see checkout/page.jsx) and a manual
//     "Clear Cart" (cart/clearCart) are two different actions now, but
//     both delete the same way: either way there's nothing left to call
//     abandoned.
//   - Fetched on attach; if the customer has one AND the live cart is
//     currently empty, it's restored straight into the cart.
//
// Same trust boundary as customers/recently-viewed.js: the route calling
// this requires the caller's own OrnaVerse bearer token, so only an
// authenticated operator can read/write anything, and only against a
// customer they can already see through the app's normal flows. No price
// is re-verified against OrnaVerse here — same reasoning as recently-
// viewed's snapshot: this is for restoring what was in the cart and for
// marketing visibility into abandoned carts, not a financial record: the
// real price is always re-derived live when (if) the sale is completed.

import { getDb } from './client';
import { normalizeMobileKey } from './normalizeMobile';

// _POS suffix (2026-08-27) — see wishlist.js's identical comment; same
// live rename (3 docs before and after, confirmed), same reasoning.
const COLLECTION = 'abandonedCarts_POS';

/**
 * Builds the filter a read/write should use — mobile-keyed when possible,
 * falling back to party_id alone otherwise. Shared so upsert/get/delete can
 * never drift into using different keys for the "same" customer.
 */
function buildFilter(partyId, customerMobile) {
  const mobileKey = normalizeMobileKey(customerMobile);
  return mobileKey ? { mobileKey } : { party_id: partyId };
}

/**
 * @param {{ party_id: number, customerName?: string, customerMobile?: string,
 *   items: object[], subtotal?: number, taxAmount?: number, total?: number,
 *   company_id?: number }} params
 */
export async function upsertAbandonedCart({ party_id, customerName, customerMobile, items, subtotal, taxAmount, total, company_id }) {
  const db = await getDb();
  const mobileKey = normalizeMobileKey(customerMobile);
  await db.collection(COLLECTION).updateOne(
    buildFilter(party_id, customerMobile),
    {
      $set: {
        mobileKey,
        party_id,
        customerName:  customerName  ?? null,
        customerMobile: customerMobile ?? null,
        items,
        subtotal:  subtotal  ?? null,
        taxAmount: taxAmount ?? null,
        total:     total     ?? null,
        // Which store was active when this snapshot was saved (2026-08-27)
        // — tagged on so the cart data carries its store instead of losing
        // it; not used to scope the lookup.
        company_id: company_id ?? null,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
}

/**
 * @param {{ partyId: number, customerMobile?: string }} params
 * @returns {Promise<object|null>}
 */
export async function getAbandonedCart({ partyId, customerMobile }) {
  const db = await getDb();
  return db.collection(COLLECTION).findOne(buildFilter(partyId, customerMobile));
}

/**
 * Called once the cart is no longer pending — a completed sale or a
 * manual clear (see the middleware's cart/clearCart case).
 * @param {{ partyId: number, customerMobile?: string }} params
 */
export async function deleteAbandonedCart({ partyId, customerMobile }) {
  const db = await getDb();
  await db.collection(COLLECTION).deleteOne(buildFilter(partyId, customerMobile));
}
