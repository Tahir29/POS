// src/lib/mongo/walkins.js
//
// Our OWN log of walk-in events, one document PER VISIT (not per customer)
// — answers "who walked into store X between these dates", a query
// OrnaVerse can't answer itself: its WalkIn Lookup/Register endpoints are
// both single-customer, mobile-keyed calls with no listing mode (sending
// anything besides `{ mobile }` alone returns a 500). This app keeps its
// own record of every walk-in it observes so retargeting/marketing can
// query it later.
//
// Written from useWalkInLookup.js's mutation, the moment OrnaVerse reports
// a real WalkInRecorded:true match — not on every keystroke/search attempt.

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
