// src/lib/ornaverse/environment.js
//
// The ONE flag that says which OrnaVerse environment this deployment
// targets. Deliberately its own tiny file, not part of upstream.js: this
// file contains no secrets and no process.env reads at all.
//
// Since the 2026-09 auth rewire (see lib/ornaverse/session.js), the app
// authenticates identically on both environments — a real per-operator
// OrnaVerse cookie session, no OAuth client of any kind — so this flag now
// only ever needs to reach upstream.js (server-only), which resolves it to
// the right base URL.
//
// Change ACTIVE_ENV here to switch environments everywhere at once.
//
export const ACTIVE_ENV = 'LIVE'; // 'LIVE' | 'UAT'
