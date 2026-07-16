// src/lib/analytics/gtag.js
// Thin wrapper around the GA4 gtag.js global — loaded via <Script> in
// src/app/layout.js, driven by NEXT_PUBLIC_GA_MEASUREMENT_ID. Every call
// here is a no-op if gtag hasn't loaded (env var unset, script blocked,
// SSR) — analytics must never be able to break the app.

export function isGtagAvailable() {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
}

/**
 * Send a single event to GA4.
 * @param {string} eventName
 * @param {object} params
 */
export function sendToGA(eventName, params = {}) {
  if (!isGtagAvailable()) return;
  try {
    window.gtag('event', eventName, params);
  } catch {
    // analytics failures must never surface to the user
  }
}
