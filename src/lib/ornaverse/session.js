// src/lib/ornaverse/session.js
// SERVER-ONLY. The app's one and only source of operator identity.
//
// ── WHY THIS REPLACED THE OAUTH BEARER-TOKEN FLOW ──────────────────────────
//
// This app used to authenticate every Services/* call with an OAuth bearer
// token (connect/token). That worked cleanly on UAT (a public client, real
// `password` grant) but not on LIVE (a confidential client, `client_credentials`
// only) — LIVE's token was always issued for ONE FIXED SERVICE IDENTITY,
// never the operator who actually signed in, no matter what they typed.
// Several OrnaVerse endpoints are deliberately scoped to "the authenticated
// identity's own home company/permissions"
// (Administration/Stores/GetUserCompanies, Order/List, Invoice/List, the
// InterstoreReturn workflow actions) — correct behaviour on OrnaVerse's
// side, but it broke for us on LIVE specifically because our identity
// there was never a real person: a single-store login always landed on
// "please select a store", a real order could go missing from our own
// Orders tab, and the InterstoreReturn approval workflow was unreachable
// for any real store operator.
//
// OrnaVerse's OWN client never hits any of this, because it never uses
// OAuth for its own users at all — it signs in via a real, per-operator
// ASP.NET cookie session (~/Account/Login), the exact same one this file
// already established for report printing alone. Confirmed live
// (2026-09-15) that this cookie session:
//   - logs in correctly with real credentials on BOTH UAT and LIVE
//   - authorizes arbitrary Services/* POST calls with no bearer token,
//     given the cookie + a required X-CSRF-TOKEN header
//   - resolves the REAL, correctly-scoped identity (GetUserCompanies
//     returned the real restricted company list for a single-store login,
//     identically on both environments)
//   - enforces the same permission model either way (a denied action was
//     denied identically under cookie vs bearer auth)
//
// So this is now the ONLY authentication this app performs. There is no
// OAuth client, no access/refresh token, nothing token-shaped in Redux or
// localStorage — just this httpOnly session cookie on our own origin,
// mapping (via ornaverseSessions.js, Mongo-backed so it survives across
// separate serverless invocations) to the real OrnaVerse cookie jar.
//
// ── WHY NO STORED PASSWORD ─────────────────────────────────────────────────
//
// The operator's own credentials pass through this server on their way to
// this login dance and are spent once, then discarded:
//   • nothing to store, rotate, or leak — no password on disk or in memory
//   • no shared robot account to create and maintain
//   • every action is attributed to the real operator, so OrnaVerse's own
//     audit trail is honest about who did what
//
// The login contract is taken from OrnaVerse's own LoginPage.js:
//     POST ~/Account/Login   (JSON)   { username, password }
//
// ── CONSEQUENCES, STATED PLAINLY ───────────────────────────────────────────
//
// • The account must have 2FA disabled: a non-interactive login cannot
//   answer the prompt OrnaVerse's own LoginPage handles interactively.
// • We cannot silently re-login when the cookie expires, because we never
//   kept the password — a rejected session surfaces "sign in again"
//   instead of failing obscurely, the same trade-off this file already
//   made when it only covered printing.

import { createSession, getSession, deleteSession } from '@/lib/mongo/ornaverseSessions';
import { UPSTREAM } from '@/lib/ornaverse/upstream';

/** Name of the httpOnly cookie carrying the session id on OUR origin. */
export const SESSION_COOKIE = 'pos_session_id';

/**
 * Pulls the cookie pairs we need out of a Set-Cookie header list, keyed by
 * cookie name (so a later response's cookie of the same name can cleanly
 * override an earlier one — see createOrnaverseSession below).
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
 * Exchanges the operator's credentials for a real OrnaVerse cookie session
 * and returns an opaque id for it, persisted in Mongo (see
 * lib/mongo/ornaverseSessions.js). The credentials are used here and
 * discarded.
 *
 * Requires ASP.NET Core's antiforgery token: a bare POST with no prior GET
 * is rejected with an EMPTY 400 (no body, no cookie at all). The login
 * page's own GET response sets an antiforgery cookie + a CSRF-TOKEN cookie;
 * the POST must carry both the cookie and the token (as X-CSRF-TOKEN) back.
 * A correct login returns real .AspNetAuth/.AspNetCore.Session cookies; a
 * wrong password returns zero new cookies plus a proper
 * {"Error":{"Message":...}} body — that's the real success/failure signal,
 * checked against the POST's own cookies, not the merged jar (the GET's
 * antiforgery cookie is present either way and would otherwise mask a
 * genuine login failure).
 *
 * @param {{ username: string, password: string }} params
 * @returns {Promise<string>} session id, to be stored in an httpOnly cookie
 */
export async function createOrnaverseSession({ username, password }) {
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

  if (authPairs.size === 0) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.Error?.Message || body?.Error?.Code || '';
    } catch { /* empty or non-JSON body */ }

    const err = new Error(
      detail
        ? `OrnaVerse did not grant a session: ${detail}`
        : 'OrnaVerse returned no session cookie.'
    );
    // OrnaVerse's own client treats this code as "prompt for a code"; we can't.
    err.code = /TwoFactor/i.test(detail) ? 'TWO_FACTOR_REQUIRED' : 'LOGIN_FAILED';
    throw err;
  }

  // Carry the full jar forward like a real browser would — the POST's own
  // cookies win by name, but anything the GET set that the POST didn't
  // reissue (the antiforgery cookie itself, typically) stays in.
  const merged = new Map(pagePairs);
  for (const [name, pair] of authPairs) merged.set(name, pair);

  // The PRE-login antiforgery/CSRF pair does not survive authentication —
  // ASP.NET Core's antiforgery cookie is bound to the identity active when
  // it was issued, and ours was issued before sign-in. One more GET, now
  // WITH the auth cookies attached, gets a fresh pair that's actually valid
  // for the authenticated session — without this, every subsequent
  // Services/*/Print/Render call 400s with no body.
  const authedPage = await fetch(`${UPSTREAM}/`, {
    method:   'GET',
    headers:  { Cookie: [...merged.values()].join('; ') },
    cache:    'no-store',
    redirect: 'manual',
  });
  const { pairs: authedPairs, csrf: authedCsrf } = parseCookies(authedPage);
  for (const [name, pair] of authedPairs) merged.set(name, pair);

  return createSession({
    cookie: [...merged.values()].join('; '),
    csrf: authedCsrf ?? authCsrf ?? pageCsrf,
    username,
  });
}

/**
 * @param {string|undefined} id
 * @returns {Promise<{ cookie: string, csrf: string|null, username: string }|null>}
 */
export async function getOrnaverseSession(id) {
  return getSession(id);
}

/**
 * Resolves the current request's session cookie straight to its OrnaVerse
 * cookie/CSRF pair — what every route that talks to OrnaVerse (the
 * Services/* proxy and the handful of internal routes that call OrnaVerse
 * directly, e.g. api/customers/sync) actually needs.
 *
 * @param {Request} request
 * @returns {Promise<{ cookie: string, csrf: string|null, username: string }|null>}
 */
export async function getSessionFromRequest(request) {
  const id = request.cookies?.get?.(SESSION_COOKIE)?.value
    ?? parseCookieHeader(request.headers.get('cookie'))[SESSION_COOKIE];
  return getOrnaverseSession(id);
}

function parseCookieHeader(header) {
  const out = {};
  for (const part of (header ?? '').split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name) out[name] = rest.join('=');
  }
  return out;
}

/** Drop a session — on sign-out, or when OrnaVerse rejects its cookie. */
export async function destroyOrnaverseSession(id) {
  await deleteSession(id);
}
