// src/lib/mongo/client.js
//
// Single cached MongoDB connection, reused across requests. Cached on
// `globalThis` (not a module-level variable) so it also survives Next.js
// dev-mode hot-reloads instead of leaking a new connection per save.
//
// DB name comes from MONGODB_URI's own path (not a separate env var) —
// MongoClient.db() with no argument uses exactly that.

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
  return client.db();
}
