// src/lib/cookies.js
// Shared cookie-clearing utility for the current origin.
//
// Used by every logout path (normal logout, refresh-token-failure logout,
// dev "clear all site data" reset) so a stale/poisoned cookie set by the
// backend (e.g. a load-balancer affinity cookie) can never outlive a
// session the way it previously could when only the dev tool cleared
// cookies and normal logout left them untouched.
//
// NOTE: can only clear cookies visible to document.cookie — httpOnly
// cookies are invisible to JS and can only be cleared by the server
// (Set-Cookie with an expired date) or by the browser's own
// "Clear site data" action.

export function clearAllCookies() {
  if (typeof document === 'undefined') return;

  document.cookie.split(';').forEach((c) => {
    document.cookie = c
      .replace(/^ +/, '')
      .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
  });
}
