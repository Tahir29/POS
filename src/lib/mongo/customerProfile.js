// src/lib/mongo/customerProfile.js
//
// Mirrors an OrnaVerse CustomerRow into Mongo, keyed by party_id, for
// personalization/retargeting — MINUS PAN.
//
// PAN EXCLUDED ON PURPOSE: `pan_no` and `pan_document` are stripped before
// every write. OrnaVerse already holds this data and the checkout PAN panel
// reads it live from there, not from this mirror — mirroring it here would
// add leak exposure for zero personalization value. If a real need for it
// shows up later, add it back deliberately (with field-level encryption)
// rather than by accident.

import { getDb } from './client';

const COLLECTION = 'customers_POS';

// Deny-list, not an allow-list, so any OTHER field OrnaVerse adds later
// still flows through the mirror — only these two are deliberately withheld.
const EXCLUDED_FIELDS = ['pan_no', 'pan_document'];

function omitExcludedFields(profile) {
  const clean = { ...profile };
  for (const field of EXCLUDED_FIELDS) delete clean[field];
  return clean;
}

/**
 * @param {{ party_id: number, profile: object }} params — profile is the raw
 *   CustomerRow (normalizeCustomer(entity).raw, or the entity itself)
 */
export async function upsertCustomerProfile({ party_id, profile }) {
  const db = await getDb();
  const toStore = omitExcludedFields(profile);

  await db.collection(COLLECTION).updateOne(
    { party_id },
    {
      $set: { party_id, profile: toStore, syncedAt: new Date() },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
}

/**
 * @param {number} partyId
 * @returns {Promise<object|null>} the stored profile (never contains PAN — see above)
 */
export async function getCustomerProfile(partyId) {
  const db = await getDb();
  const doc = await db.collection(COLLECTION).findOne({ party_id: partyId });
  return doc?.profile ?? null;
}
