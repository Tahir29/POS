// src/lib/ornaverse/authConfig.js
//
// Client-safe OAuth client shape (client_id / grant_type / scope) per
// OrnaVerse environment, derived from the SAME ACTIVE_ENV flag
// (environment.js) that upstream.js uses — so flipping ACTIVE_ENV there
// switches the upstream URL, the server-injected client secret, AND this
// client-side auth shape together in one place. Before this file existed,
// ACTIVE_ENV lived only in upstream.js while appConfig.js's AUTH block
// hardcoded the matching client_id/grant_type by hand — flipping one
// without the other is exactly what caused the LIVE switch on 2026-08-22
// to 404/401 everywhere (UAT's client_id sent to LIVE's token endpoint →
// invalid_client on every login, so no request after that ever carried a
// valid bearer token).
//
// Split out from upstream.js on purpose, not merged into it: upstream.js is
// SERVER-ONLY (it holds CLIENT_SECRET, which must never reach the browser).
// This file holds no secret at all — client_id is not secret by itself
// (see api/[...path]/route.js's comment: it's already sent in the token
// request body from the browser) — so it's safe for appConfig.js (a
// client-visible module, read by LoginForm/authService.js) to import.
// Reads ACTIVE_ENV from environment.js, NOT upstream.js, specifically so
// importing this file never pulls upstream.js's CLIENT_SECRET computation
// into the client module graph at all.
//
// Confirmed live 2026-08-22 against real OrnaVerse endpoints:
//   - UAT's client (65948cb671ae46e1a04653f505e29332) is PUBLIC — only
//     Password / Authorization Code / Refresh Token grants, no secret.
//     Confirmed 2026-07-29 (see api/[...path]/route.js).
//   - LIVE's client (ff15960083ee4b4694bfb918e56c13c6) is CONFIDENTIAL and
//     only grants via client_credentials — a service-account grant with no
//     username/password/user-identity in it at all (LoginForm's username +
//     password fields still get sent by authService.js's generateToken();
//     OrnaVerse simply ignores them for this grant type — confirmed live,
//     a request with no username/password at all succeeds identically).
//     That means on LIVE the app authenticates as ONE fixed service
//     identity, not as the individual signed-in operator — per-employee
//     attribution on a sale relies on the separate "Sales Person" picker
//     already used at checkout (useSalesPersonOptions.js), not on who
//     logged in. Worth knowing, not a bug.
//   - LIVE's client_credentials grant REJECTS the offline_access scope:
//     400 invalid_request, "The client application is not allowed to use
//     the 'offline_access' scope." That scope only makes sense for a grant
//     with a delegated session to refresh; client_credentials has none, so
//     GRANT_TYPE_REFRESH is a UAT-only concept in practice — LIVE tokens
//     just get re-requested via client_credentials again on expiry instead
//     of refreshed.

import { ACTIVE_ENV } from './environment';

const AUTH_BY_ENV = {
  UAT: {
    CLIENT_ID:           '65948cb671ae46e1a04653f505e29332',
    GRANT_TYPE_PASSWORD: 'password',
    SCOPE:               'profile email offline_access',
  },
  LIVE: {
    CLIENT_ID:           'ff15960083ee4b4694bfb918e56c13c6',
    GRANT_TYPE_PASSWORD: 'client_credentials',
    SCOPE:               'profile email',
  },
};

export const ORNAVERSE_AUTH = AUTH_BY_ENV[ACTIVE_ENV];
