// src/lib/mongo/client.js
//
// Single cached MongoDB connection, reused across requests. Next.js route
// handlers can be invoked many times per server process — without caching,
// each request would open a brand new connection to Atlas, which is slow
// and will exhaust the connection pool under real traffic. Caching on
// `globalThis` (not just a module-level variable) also survives Next.js
// dev-mode hot-reloads, which otherwise re-run this module fresh on every
// save and would otherwise leak a new connection per save.
//
// FIXED 2026-08-21: the first version of this file cached the promise under
// `globalThis._mongoClientPromise` but read it back from
// `globalThis.mongoClientPromise` (no underscore) — the read never matched
// the write, so `cachedClientPromise` was always undefined and every single
// call opened a brand new MongoClient, silently defeating the whole point
// of caching. Fixed to use the same key on both sides.
//
// DB NAME: not read from a separate env var. MONGODB_URI's own path already
// names the database (".../lucira_pos?..."), and MongoClient.db() with no
// argument uses exactly that — one env var, not two.

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('[Lucira POS] MONGODB_URI is not set. Add it to .env.local.');
}

let cachedClientPromise = globalThis._mongoClientPromise;

if (!cachedClientPromise) {
  const client = new MongoClient(uri);
  cachedClientPromise = client.connect();
  globalThis._mongoClientPromise = cachedClientPromise;
}

export async function getDb() {
  const client = await cachedClientPromise;
  return client.db(); // no name passed — uses the db named in MONGODB_URI's own path
}
