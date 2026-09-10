// src/lib/cookies.js
// Shared cookie-clearing utility for the current origin, used by every
// logout path.
//
// NOTE: can only clear cookies visible to document.cookie — httpOnly
// cookies are invisible to JS and can only be cleared by the server or the
// browser's own "Clear site data" action.

export function clearAllCookies() {
  if (typeof document === 'undefined') return;

  document.cookie.split(';').forEach((c) => {
    document.cookie = c
      .replace(/^ +/, '')
      .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
  });
}
