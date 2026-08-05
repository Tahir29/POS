// src/lib/ornaverse/upstream.js
// SERVER-ONLY. Which OrnaVerse environment this deployment talks to.
//
// Extracted so the API proxy (app/api/[...path]/route.js) and the report
// renderer (app/api/report/render/route.js) resolve the same upstream from
// one place — two copies of this would silently drift the day someone
// switches environments.
//
// To switch back to LIVE, change ACTIVE_ENV here. See route.js for why the
// LIVE client needs a secret and UAT (a public OAuth client) does not.

export const ACTIVE_ENV = 'UAT'; // 'LIVE' | 'UAT'

export const UPSTREAM = (
  (ACTIVE_ENV === 'LIVE'
    ? process.env.NEXT_PUBLIC_ORNAVERSE_BASE_URL_LIVE
    : process.env.NEXT_PUBLIC_ORNAVERSE_BASE_URL_UAT) || ''
).replace(/\/+$/, '');

export const CLIENT_SECRET = (
  ACTIVE_ENV === 'LIVE'
    ? process.env.ORNAVERSE_LIVE_CLIENT_SECRET
    : process.env.ORNAVERSE_UAT_CLIENT_SECRET
) || '';
