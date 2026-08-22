// src/lib/ornaverse/reportSession.js
// SERVER-ONLY. Holds each signed-in operator's OrnaVerse cookie session so
// our POS can render invoice reports itself.
//
// ── WHY THIS EXISTS ────────────────────────────────────────────────────────
//
// OrnaVerse has two authentication systems on one host:
//
//   /Services/**  — the JSON API. OAuth bearer token (password grant). This
//                   is what the whole app already uses.
//   /Print/**     — report rendering. An MVC endpoint authenticated by
//                   SESSION COOKIE. It ignores the bearer token entirely and
//                   answers with their "Login to your account" HTML page
//                   (verified 2026-08-05).
//
// So the invoice formats their POS offers cannot be fetched with the token
// the rest of our app holds. There is no /Services/ equivalent — the one we
// had, POS/Invoice/GeneratePDF, returns 500 on UAT.
//
// ── WHY NO STORED PASSWORD ─────────────────────────────────────────────────
//
// The obvious fix is a service account in env vars. This deliberately does
// something better: the operator's own credentials ALREADY pass through this
// server on their way to connect/token at sign-in, so we spend them once more
// on ~/Account/Login in the same request and keep only the resulting cookie.
//
//   • nothing to store, rotate, or leak — no password on disk or in memory
//   • no shared robot account to create and maintain
//   • reports are attributed to the real operator, so the ERP audit trail is
//     honest about who printed what
//
// The login contract is taken from their own LoginPage.js:
//     POST ~/Account/Login   (JSON)   { username, password }
//
// ── CONSEQUENCES, STATED PLAINLY ───────────────────────────────────────────
//
// • Nothing can render headlessly. The session exists only while an operator
//   is signed in, which is fine for a counter POS and would not be for a
//   nightly job.
// • We cannot silently re-login when the cookie expires, because we never
//   kept the password. The render route surfaces "sign in again" instead of
//   failing obscurely — a deliberate trade for not holding credentials.
// • The account must have 2FA disabled: a non-interactive login cannot
//   answer the prompt their LoginPage handles interactively.
//
// Sessions live in module memory, so they are per-process and vanish on
// restart — an operator simply signs in again. Deliberately NOT persisted:
// a cookie jar on disk is the thing we were trying to avoid.

import { randomUUID } from 'crypto';
import { UPSTREAM } from '@/lib/ornaverse/upstream';

/** @type {Map<string, { cookie: string, csrf: string|null, at: number, username: string }>} */
const sessions = new Map();

// Long enough to cover a shift, short enough that an abandoned session isn't
// held forever. Expiry here is ours; OrnaVerse's own cookie lifetime is not
// advertised, so the render route also detects rejection at use time.
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

function sweep() {
  const cutoff = Date.now() - MAX_AGE_MS;
  for (const [id, session] of sessions) {
    if (session.at < cutoff) sessions.delete(id);
  }
}

/**
 * Pulls the cookie pairs we need out of a Set-Cookie header list, keyed by
 * cookie name (so a later response's cookie of the same name can cleanly
 * override an earlier one — see createReportSession below).
 * Node's fetch exposes them via getSetCookie(); fall back to the raw header
 * for runtimes that don't.
 *
 * @returns {{ pairs: Map<string, string>, csrf: string|null }}
 */
function parseCookies(response) {
  const raw = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);

  const pairs = new Map();
  let csrf = null;
  for (const entry of raw) {
    // A Set-Cookie value is "name=value; Path=/; HttpOnly; ..." — only the
    // first segment goes back on the wire. Split on commas that begin a new
    // cookie, not the ones inside Expires dates.
    for (const chunk of String(entry).split(/,(?=[^;=]+?=)/)) {
      const pair = chunk.split(';')[0].trim();
      if (!pair || !pair.includes('=')) continue;
      const [name, ...rest] = pair.split('=');
      pairs.set(name.trim(), pair);
      if (name.trim() === 'CSRF-TOKEN') csrf = rest.join('=');
    }
  }
  return { pairs, csrf };
}

/**
 * Exchanges the operator's credentials for an OrnaVerse cookie session and
 * returns an opaque id for it. The credentials are used here and discarded.
 *
 * CHANGED 2026-08-21: OrnaVerse's UAT ~/Account/Login now enforces ASP.NET
 * Core's antiforgery token — confirmed live by hand: a bare POST with no
 * prior GET is rejected with an EMPTY 400 (no body, no cookie at all),
 * which is exactly what was surfacing to every operator as "Your OrnaVerse
 * print session has expired" on every sign-in, not just a stale one. This
 * wasn't there when this file's contract was first captured (2026-08-05) —
 * something changed on their side since. The login page's own GET response
 * sets an antiforgery cookie + a CSRF-TOKEN cookie; the POST must carry
 * both the cookie and the token (as X-CSRF-TOKEN) back — the exact same
 * pairing /Print/Render already required below, just now needed one step
 * earlier too. Verified: a correct login now returns real
 * .AspNetAuth/.AspNetCore.Session cookies; a wrong password still returns
 * zero new cookies plus a proper {"Error":{"Message":...}} body, so the
 * existing "no cookie = failure" signal still works — it just has to be
 * checked against the POST's own cookies, not the merged jar (the GET's
 * antiforgery cookie is present either way and would otherwise mask a
 * genuine login failure).
 *
 * @param {{ username: string, password: string }} params
 * @returns {Promise<string>} session id, to be stored in an httpOnly cookie
 */
export async function createReportSession({ username, password }) {
  if (!username || !password) {
    const err = new Error('Username and password are required.');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const loginPage = await fetch(`${UPSTREAM}/Account/Login`, {
    method:   'GET',
    cache:    'no-store',
    redirect: 'manual',
  });
  const { pairs: pagePairs, csrf: pageCsrf } = parseCookies(loginPage);

  const response = await fetch(`${UPSTREAM}/Account/Login`, {
    method:   'POST',
    headers:  {
      'Content-Type': 'application/json',
      Cookie: [...pagePairs.values()].join('; '),
      ...(pageCsrf ? { 'X-CSRF-TOKEN': pageCsrf } : {}),
    },
    body:     JSON.stringify({ username, password }),
    cache:    'no-store',
    redirect: 'manual',
  });

  const { pairs: authPairs, csrf: authCsrf } = parseCookies(response);

  // The real tell is the POST's OWN cookies, not the merged jar — the GET's
  // antiforgery cookie is present even on a failed login and would
  // otherwise make every failure look like a success.
  if (authPairs.size === 0) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.Error?.Message || body?.Error?.Code || '';
    } catch { /* empty or non-JSON body */ }

    const err = new Error(
      detail
        ? `OrnaVerse did not grant a report session: ${detail}`
        : 'OrnaVerse returned no session cookie.'
    );
    // Their own client treats this code as "prompt for a code"; we can't.
    err.code = /TwoFactor/i.test(detail) ? 'TWO_FACTOR_REQUIRED' : 'LOGIN_FAILED';
    throw err;
  }

  // Carry the full jar forward like a real browser would — the POST's own
  // cookies win by name, but anything the GET set that the POST didn't
  // reissue (the antiforgery cookie itself, typically) stays in.
  const merged = new Map(pagePairs);
  for (const [name, pair] of authPairs) merged.set(name, pair);

  // CHANGED 2026-08-21 (second half of the same fix): the PRE-login
  // antiforgery/CSRF pair does not survive authentication. Confirmed by
  // hand — /Print/Render rejected it with the exact same empty-400
  // signature /Account/Login had before the fix above, even though the
  // login itself had genuinely succeeded. ASP.NET Core's antiforgery cookie
  // is bound to the identity active when it was issued; ours was issued
  // before sign-in, so it stops validating the moment the auth cookie
  // lands. One more GET, now WITH the auth cookies attached, gets a fresh
  // pair that's actually valid for the authenticated session — verified
  // live: without this step every /Print/Render call 400s with no body
  // (identical to the pre-fix login failure); with it, real report HTML
  // comes back.
  const authedPage = await fetch(`${UPSTREAM}/`, {
    method:   'GET',
    headers:  { Cookie: [...merged.values()].join('; ') },
    cache:    'no-store',
    redirect: 'manual',
  });
  const { pairs: authedPairs, csrf: authedCsrf } = parseCookies(authedPage);
  for (const [name, pair] of authedPairs) merged.set(name, pair);

  sweep();
  const id = randomUUID();
  sessions.set(id, {
    cookie: [...merged.values()].join('; '),
    csrf: authedCsrf ?? authCsrf ?? pageCsrf,
    at: Date.now(),
    username,
  });
  return id;
}

/**
 * @param {string|undefined} id
 * @returns {{ cookie: string, csrf: string|null }|null}
 */
export function getReportSession(id) {
  if (!id) return null;
  const session = sessions.get(id);
  if (!session) return null;
  if (Date.now() - session.at > MAX_AGE_MS) {
    sessions.delete(id);
    return null;
  }
  return session;
}

/** Drop a session — on sign-out, or when OrnaVerse rejects its cookie. */
export function destroyReportSession(id) {
  if (id) sessions.delete(id);
}

/** Name of the httpOnly cookie carrying the session id on OUR origin. */
export const REPORT_SESSION_COOKIE = 'pos_report_sid';
