// src/lib/mongo/ornaverseSessions.js
//
// Durable store for each signed-in operator's real OrnaVerse cookie
// session — the app's ONLY source of identity as of the 2026-09 auth
// rewire (see lib/ornaverse/session.js for why: OrnaVerse's own client
// never uses OAuth bearer tokens for its users, only a real per-operator
// ASP.NET cookie session, and that's what this app now uses too).
//
// Previously kept in a plain in-memory Map (fine when this only backed the
// occasional /Print/Render call) — now that every Services/* call needs it,
// it has to survive across separate serverless invocations, so it lives in
// the same Mongo connection the rest of the app already uses.
//
// A TTL index expires documents automatically 12h after creation — long
// enough to cover a shift, short enough that an abandoned session doesn't
// linger. OrnaVerse's own cookie lifetime is not advertised, so a session
// can also stop working before this TTL fires; callers detect that at use
// time (an upstream rejection), not by trusting this expiry alone.

import { getDb } from './client';
import { randomUUID } from 'crypto';

const COLLECTION = 'ornaverseSessions_POS';
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

let indexesEnsured = false;

async function collection() {
  const db = await getDb();
  const coll = db.collection(COLLECTION);
  if (!indexesEnsured) {
    indexesEnsured = true;
    // Fire-and-forget — an index that already exists is a no-op, and a
    // races-with-itself double-create is harmless; never block a request
    // on this.
    coll.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {});
  }
  return coll;
}

/**
 * @param {{ cookie: string, csrf: string|null, username: string }} params
 * @returns {Promise<string>} opaque session id
 */
export async function createSession({ cookie, csrf, username }) {
  const id = randomUUID();
  const now = new Date();
  await (await collection()).insertOne({
    _id: id,
    cookie,
    csrf,
    username,
    createdAt: now,
    lastUsedAt: now,
    expiresAt: new Date(now.getTime() + MAX_AGE_MS),
  });
  return id;
}

/**
 * @param {string|undefined|null} id
 * @returns {Promise<{ cookie: string, csrf: string|null, username: string }|null>}
 */
export async function getSession(id) {
  if (!id) return null;
  const doc = await (await collection()).findOne({ _id: id });
  if (!doc) return null;

  // Touch lastUsedAt best-effort — informational only (the TTL index keys
  // off expiresAt, set once at creation), never worth failing a real
  // request over.
  (await collection())
    .updateOne({ _id: id }, { $set: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { cookie: doc.cookie, csrf: doc.csrf, username: doc.username };
}

/** @param {string|undefined|null} id */
export async function deleteSession(id) {
  if (!id) return;
  await (await collection()).deleteOne({ _id: id }).catch(() => {});
}
