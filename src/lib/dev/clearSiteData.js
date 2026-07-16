// src/lib/dev/clearSiteData.js
// DEV-ONLY utility — wipes Redux Persist state (auth tokens, store, cart),
// sessionStorage, and all cookies for the current origin.
//
// Built after repeatedly hitting stale-token 400s during UAT/Live/client_id
// switching (2026-07-14) — a plain page reload does NOT clear Redux Persist
// state, so an old token can silently keep being used across reloads even
// after env vars or client_id change.
//
// IMPORTANT: this calls persistor.purge() rather than localStorage.clear()
// directly. A direct localStorage.clear() races against Redux Persist's own
// write-back — the in-memory store still holds the old state at the moment
// of clearing, and if Persist flushes again before navigation completes, it
// silently rewrites the stale data right back into localStorage. purge()
// resets both the persisted storage AND the in-memory store together,
// closing that race. Confirmed via testing 2026-07-14: a bare
// localStorage.clear() did NOT reliably fix stale-token 400s the way
// DevTools' manual "Clear site data" did; purge() does.
//
// Only exposed in development — never shipped to a production build.

import { persistor } from '@/store';
import { clearAllCookies } from '@/lib/cookies';

export async function clearAllSiteData() {
  if (typeof window === 'undefined') return;

  await persistor.purge();

  sessionStorage.clear();

  clearAllCookies();

  window.location.href = '/login';
}