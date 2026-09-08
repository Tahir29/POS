// src/lib/mongo/walkins.js
//
// Our OWN log of walk-in events, one document PER VISIT (not one doc per
// customer, unlike abandonedCart.js/recentlyViewed.js/wishlist.js) — this
// exists specifically to answer "who walked into store X between these two
// dates", which is a list-many-across-customers query none of those other
// modules need. See this file's own header history: OrnaVerse's
// Services/POS/WalkIn/Lookup and /Register (see apiEndpoints.js's WALKIN
// block) are BOTH single-customer, mobile-keyed calls with no listing
// mode at all — confirmed live 2026-09-08 (LIVE: sending anything other
// than `{ mobile }` alone, including a bare `company_id` or a date range,
// returns a flat 500) and confirmed again straight from OrnaVerse's own
// request schemas for both endpoints (Lookup and Register take the exact
// same shape — mobile + optional profile fields, no company_id/date
// params on either). OrnaVerse has nowhere to list this data back out, so
// this app keeps its own record of every walk-in it observes, specifically
// so retargeting/marketing can query it later.
//
// WRITTEN FROM: useWalkInLookup.js's mutation, the moment OrnaVerse itself
// reports WalkInRecorded:true for a real match — see that hook's own
// comment for why "recorded" is defined the same way OrnaVerse defines it,
// not on every keystroke/search attempt.

import { getDb } from './client';

const COLLECTION = 'walkins_POS';

/**
 * @param {{
 *   mobile: string,
 *   customerName?: string|null,
 *   walkInCustomerId?: number|null,
 *   company_id: number,
 *   companyName?: string|null,
 *   companyCode?: string|null,
 *   agentUsername?: string|null,
 * }} params
 */
export async function recordWalkIn({
  mobile, customerName, walkInCustomerId, company_id, companyName, companyCode, agentUsername,
}) {
  const db = await getDb();
  await db.collection(COLLECTION).insertOne({
    mobile,
    customerName:     customerName     ?? null,
    walkInCustomerId: walkInCustomerId ?? null,
    company_id,
    companyName: companyName ?? null,
    companyCode: companyCode ?? null,
    agentUsername: agentUsername ?? null,
    createdAt: new Date(),
  });
}

/**
 * Lists walk-in events for one store, optionally bounded by a date range —
 * newest first. `fromDate`/`toDate`, when given, are real Date objects
 * (caller pads to start/end of day — see useWalkInsList.js) so the range
 * is inclusive of both endpoint calendar days.
 *
 * @param {{ company_id: number, fromDate?: Date|null, toDate?: Date|null }} params
 * @returns {Promise<object[]>}
 */
export async function listWalkIns({ company_id, fromDate = null, toDate = null }) {
  const db = await getDb();

  const filter = { company_id };
  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = fromDate;
    if (toDate)   filter.createdAt.$lte = toDate;
  }

  return db.collection(COLLECTION)
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
}
