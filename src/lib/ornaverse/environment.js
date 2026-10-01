// Which OrnaVerse environment this server talks to — 'LIVE' or 'UAT'.
//
// Read from the ACTIVE_ENV env var (.env.local on this server) instead of a
// hardcoded literal, specifically so flipping environments is: edit the env
// var, restart the running Node process (`pm2 restart`/`docker restart`/
// re-running `next start`) — NO rebuild, NO redeploy. A restarted process
// re-reads process.env fresh, which is all a plain (non-NEXT_PUBLIC_) env
// var needs on the server side.
//
// This does NOT reach the browser the same way — anything already baked
// into the CLIENT bundle at the last `next build` can't change without one,
// which is exactly why NEXT_PUBLIC_ is not used here. The one place this
// mattered client-side (inventoryService.js's getStockPieceBySku, which
// sends a different request body on LIVE vs UAT) now asks the server for
// this value at runtime via /api/config/environment instead of importing
// it directly — see that function's own comment.
//
// Defaults to 'LIVE' (this file's own previous hardcoded value) whenever
// ACTIVE_ENV is unset or isn't exactly 'UAT' — a missing or mistyped env var
// must never silently redirect production traffic at the UAT tenant.
const raw = process.env.ACTIVE_ENV;

if (raw && raw !== 'LIVE' && raw !== 'UAT') {
  console.warn(`[environment] ACTIVE_ENV="${raw}" is not "LIVE" or "UAT" — defaulting to LIVE.`);
}

export const ACTIVE_ENV = raw === 'UAT' ? 'UAT' : 'LIVE';
