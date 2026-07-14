// src/lib/dev/clearSiteData.js
// DEV-ONLY utility — wipes localStorage (Redux Persist state, including
// auth tokens), sessionStorage, and all cookies for the current origin.
//
// Built after repeatedly hitting stale-token 400s during UAT/Live/client_id
// switching (2026-07-14) — a plain page reload does NOT clear Redux Persist
// state, so an old token can silently keep being used across reloads even
// after env vars or client_id change. This gives a reliable one-click reset
// instead of manually clearing via DevTools → Application each time.
//
// Only exposed in development — never shipped to a production build.

export function clearAllSiteData() {
  if (typeof window === 'undefined') return;

  localStorage.clear();
  sessionStorage.clear();

  document.cookie.split(';').forEach((c) => {
    document.cookie = c
      .replace(/^ +/, '')
      .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
  });

  window.location.href = '/login';
}