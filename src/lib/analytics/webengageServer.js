// src/lib/analytics/webengageServer.js
//
// SERVER-ONLY WebEngage sender — for events with no browser involved (a
// webhook handler, a cron job, a Route Handler reacting to something
// OrnaVerse/Shopify pushed at us). Not wired into anything today —
// deliberately-built future-scope infrastructure, not dead code.
//
// THIS IS NOT WHAT POWERS TODAY'S EVENT TRACKING — that's tracker.js →
// webengage.js's client-side sendToWebEngage() (Web SDK, public license
// code). Do not call this from a React component or client hook; import it
// only from a Route Handler or a Node script.
//
// Kept in its own server-only module, never imported by anything that
// ships to the browser, because WEBENGAGE_API_KEY is a real bearer secret
// (unlike the public license code).
//
// API surface: WebEngage Data Platform REST API v1, Track Event
// (https://api.webengage.com/v1/accounts/{licenseCode}/events) — the same
// underlying REST API the environment's webengage_* MCP tools call, but
// from app server code rather than a chat session. Prefer this file, not
// the MCP tools, for anything that needs to run unattended/repeatedly.

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
