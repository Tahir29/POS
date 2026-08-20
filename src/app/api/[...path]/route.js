// src/app/api/[...path]/route.js
//
// Server-side reverse proxy for every OrnaVerse API call.
//
// Replaces the next.config.mjs rewrites()-based proxy that previously
// handled '/api/:path*'. That mechanism was returning empty-body 400s
// (bare nginx headers, Connection: close) from every business-data
// endpoint (GetUserStores, Order/List, CheckMetalRateForToday, Return/List,
// Exchange/List, BuyBack/List, ...) even with a freshly-issued, valid
// bearer token — while a hand-rolled route handler (formerly
// api/auth/token/route.js, deleted 2026-08-18 as unreferenced dead code
// once this file replaced it) hitting the exact same upstream with the
// exact same token succeeded every time. Confirmed 2026-07-15 by piping
// one fresh token through both
// mechanisms back to back in the same test: rewrite path failed, route
// handler succeeded. Whatever Next's internal rewrite-proxy does
// differently with headers on the way to nginx, doing the fetch here
// ourselves avoids it entirely.
//
// A filesystem route always wins over next.config.mjs rewrites for the
// same path, so this replaces that behavior outright — no config change
// needed there beyond removing the now-dead rewrite entry.
//
// UAT switch (2026-07-29): to avoid repeating the accidental-write-on-LIVE
// risk from testing transaction Create flows, UPSTREAM now points at
// NEXT_PUBLIC_ORNAVERSE_BASE_URL_UAT. To switch back to LIVE, change
// ACTIVE_ENV below — don't hardcode a second UPSTREAM/secret pair.
//
// The LIVE client is a confidential client: connect/token 401s with
// "WWW-Authenticate: Basic error=invalid_client, Client authentication is
// required for this application" unless the request carries HTTP Basic
// Auth (client_id:client_secret). client_id itself isn't secret (it's
// already in appConfig.js and in the request body from authService.js),
// but a secret must never reach the browser — so it's injected here,
// server-side only, from *_CLIENT_SECRET env vars (never NEXT_PUBLIC_).
//
// UAT, by contrast, is a PUBLIC client — confirmed 2026-07-29 from the UAT
// admin panel's "Edit OAuth Client (api_access)" screen (OAuth Client Type:
// Public, Grant Types: Password / Authorization Code / Refresh Token). A
// public client has no secret by definition, so ORNAVERSE_UAT_CLIENT_SECRET
// stays unset and the Basic Auth injection below is correctly skipped for
// UAT. Don't go hunting for a UAT secret — there isn't one.

// ACTIVE_ENV / UPSTREAM / CLIENT_SECRET now live in lib/ornaverse/upstream.js
// so the report renderer (api/report/render) resolves the same environment.
// Switch environments there, not here.
import { UPSTREAM, CLIENT_SECRET } from '@/lib/ornaverse/upstream';
import { checkRateLimit, getClientIp } from '@/lib/security/rateLimit';

async function proxy(request, { params }) {
  const { path } = await params;
  const targetUrl = `${UPSTREAM}/${path.join('/')}${request.nextUrl.search}`;
  const isTokenEndpoint = path.join('/') === 'connect/token';

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  const authorization = request.headers.get('authorization');
  if (authorization) headers.set('Authorization', authorization);

  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const body = hasBody ? await request.text() : undefined;

  // SEC-004 hardening (confirmed live 2026-08-18): connect/token with
  // grant_type=password is the ONLY unauthenticated, credential-guessing
  // call this proxy forwards — every other endpoint already requires a
  // bearer token issued by a prior successful login. LoginForm's 5-attempt
  // lockout is component state, not a server control, so it protects
  // nothing against a caller that skips the UI and scripts requests
  // straight at this route — and on LIVE this same route attaches the
  // app's confidential client secret to every one of those attempts (see
  // the comment below). Throttle here, before that secret is ever spent.
  //
  // Deliberately NOT applied to grant_type=refresh_token — that fires
  // automatically per active session on a timer (see useAuth.js /
  // interceptors.js) and isn't a credential guess, so throttling it would
  // just log real staff out mid-shift for no security benefit.
  //
  // Parsed once and reused below for the Basic Auth client_id lookup too —
  // avoid re-parsing the same body twice.
  const tokenParams = isTokenEndpoint && body ? new URLSearchParams(body) : null;

  if (tokenParams && tokenParams.get('grant_type') === 'password') {
    const ip = getClientIp(request);
    const username = (tokenParams.get('username') ?? '').trim().toLowerCase();

    // Two buckets: a tight one on (ip, username) to stop repeated guesses
    // against one account — sized to match LoginForm's own 5/5-min lockout
    // so the two never disagree about when a login is "locked out" — and a
    // looser one on (ip) alone to stop the same caller from working through
    // many usernames from one address. Both count every attempt, not just
    // failures, so this checks BEFORE the request is forwarded.
    const perAccount = checkRateLimit(`login:${ip}:${username}`, { limit: 5, windowMs: 5 * 60 * 1000 });
    const perIp = checkRateLimit(`login-ip:${ip}`, { limit: 20, windowMs: 5 * 60 * 1000 });

    if (!perAccount.allowed || !perIp.allowed) {
      const retryAfterSeconds = Math.max(perAccount.retryAfterSeconds, perIp.retryAfterSeconds);
      return new Response(
        JSON.stringify({
          error: 'too_many_attempts',
          error_description: 'Too many login attempts. Please try again later.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfterSeconds),
          },
        },
      );
    }
  }

  // connect/token needs client authentication for the live confidential
  // client — add HTTP Basic Auth using the client_id already present in
  // the form body (set client-side in appConfig.js, not secret) plus the
  // server-only secret. Never overrides an explicit Authorization header
  // the caller already set (e.g. a bearer token on other endpoints).
  if (tokenParams && CLIENT_SECRET && !headers.has('Authorization')) {
    const clientId = tokenParams.get('client_id');
    if (clientId) {
      const basic = Buffer.from(`${clientId}:${CLIENT_SECRET}`).toString('base64');
      headers.set('Authorization', `Basic ${basic}`);
    }
  }

  const upstreamRes = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
    cache: 'no-store',
  });

  const responseBody = await upstreamRes.arrayBuffer();
  return new Response(responseBody, {
    status: upstreamRes.status,
    headers: {
      'Content-Type': upstreamRes.headers.get('content-type') ?? 'application/json',
    },
  });
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as DELETE,
  proxy as PATCH,
};
