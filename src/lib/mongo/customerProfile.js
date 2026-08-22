// src/lib/mongo/customerProfile.js
//
// Mirrors an OrnaVerse CustomerRow into Mongo, keyed by party_id — the thin
// anchor + full-profile mirror discussed and agreed on, MINUS PAN.
//
// PAN EXCLUDED ON PURPOSE (2026-08-21): `pan_no` and `pan_document` are
// stripped out before every write. Ornaverse already holds and handles
// this data — mirroring it into a second database (which exists for
// personalization/retargeting, not KYC) adds real leak exposure for zero
// personalization value, and the checkout PAN panel already reads it live
// from Ornaverse, not from this mirror. If a real need for it shows up
// later, add it back deliberately (with field-level encryption — see the
// discussion this replaced) rather than by accident.

import { getDb } from './client';

const COLLECTION = 'customers';

// Fields to never persist here, regardless of what Ornaverse's CustomerRow
// happens to carry. Keep this list, not a positive allow-list, so any OTHER
// field Ornaverse adds later still flows through the mirror as intended —
// only these two are deliberately withheld.
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
