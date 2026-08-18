// src/lib/analytics/webengageServer.js
//
// SERVER-ONLY WebEngage sender — for events with no browser involved at
// all (a webhook handler, a cron/scheduled job, a Next.js Route Handler
// reacting to something OrnaVerse or Shopify pushed at us). Not wired into
// anything today; this is deliberately-built "future scope" infrastructure
// per the user's request, not dead code left over from a removed feature.
//
// THIS IS NOT WHAT POWERS TODAY'S EVENT TRACKING. Every event a customer
// or staff member actually triggers in the browser goes through
// tracker.js → webengage.js's client-side sendToWebEngage(), which uses
// the Web SDK (loaded in layout.js) and the PUBLIC license code. This file
// exists for the DIFFERENT case of firing a WebEngage event from server
// code that never runs in a browser — do not call this from a React
// component or a client hook; import it only from a Route Handler
// ("use server" context) or a script that runs under Node.
//
// WHY A SEPARATE FILE: WEBENGAGE_API_KEY is a real bearer secret (unlike
// the license code, which WebEngage's own Web SDK snippet embeds directly
// in page source) — it must never be imported into any file that ships to
// the browser. Keeping it in its own server-only module, never imported
// by webengage.js/tracker.js/anything under src/app/(pos)/, makes that
// mistake structurally hard to make rather than relying on remembering not
// to.
//
// API surface: WebEngage Data Platform REST API v1, Track Event —
// https://api.webengage.com/v1/accounts/{licenseCode}/events. This is a
// DIFFERENT WebEngage product surface than the four MCP tools already
// available in this environment (webengage_track_event,
// webengage_send_transactional, ...) — those let an AI agent call
// WebEngage directly from a chat session; this is app code calling the
// same underlying REST API from a running Next.js server process. Prefer
// this file, not the MCP tools, for anything that needs to run
// unattended/repeatedly as part of the actual product.

const API_HOST     = process.env.WEBENGAGE_API_HOST;
const LICENSE_CODE  = process.env.WEBENGAGE_LICENSE_CODE;
const API_KEY       = process.env.WEBENGAGE_API_KEY;

export function isWebEngageServerConfigured() {
  return !!(API_HOST && LICENSE_CODE && API_KEY);
}

/**
 * Fires one event to WebEngage from server code. Same no-op-if-unconfigured
 * rule as every other sender in this codebase — never throws into a caller
 * that didn't explicitly ask to handle a WebEngage failure.
 *
 * @param {{
 *   userId: string|number,      — the SAME id passed to
 *                                  webengage.user.login() client-side, so
 *                                  server- and client-fired events land on
 *                                  the same profile
 *   eventName: string,          — use EVENTS from './events', same as the
 *                                  client path — one shared vocabulary
 *   attributes?: object,
 * }} params
 * @returns {Promise<boolean>} true if WebEngage accepted the event
 */
export async function sendServerEventToWebEngage({ userId, eventName, attributes = {} }) {
  if (!isWebEngageServerConfigured() || !userId || !eventName) return false;

  try {
    const response = await fetch(
      `${API_HOST}/v1/accounts/${LICENSE_CODE}/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          userId:     String(userId),
          eventName,
          eventTime:  new Date().toISOString(),
          eventData:  { utm_source: 'pos', ...attributes },
        }),
      },
    );
    return response.ok;
  } catch {
    // Server-side analytics failures must never surface as a request
    // failure to whatever caller (webhook, cron) triggered this.
    return false;
  }
}
