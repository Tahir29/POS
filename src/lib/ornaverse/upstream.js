// src/lib/ornaverse/upstream.js
// SERVER-ONLY. Which OrnaVerse environment this deployment talks to.
//
// Extracted so every server-side call into OrnaVerse (the Services/* proxy,
// the report renderer, session.js's login dance) resolves the same
// upstream from one place — two copies of this would silently drift the
// day someone switches environments.
//
// To switch environments, change ACTIVE_ENV in environment.js. Since the
// 2026-09 auth rewire (see lib/ornaverse/session.js), there is no OAuth
// client per environment any more — both UAT and LIVE authenticate the
// exact same way, a real per-operator cookie session — so this file no
// longer needs to hand out a client secret alongside the URL.

import { ACTIVE_ENV } from './environment';

export { ACTIVE_ENV };

export const UPSTREAM = (
  (ACTIVE_ENV === 'LIVE'
    ? process.env.NEXT_PUBLIC_ORNAVERSE_BASE_URL_LIVE
    : process.env.NEXT_PUBLIC_ORNAVERSE_BASE_URL_UAT) || ''
).replace(/\/+$/, '');
