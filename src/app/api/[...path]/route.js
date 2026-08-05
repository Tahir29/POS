// src/app/api/[...path]/route.js
//
// Server-side reverse proxy for every OrnaVerse API call.
//
// Replaces the next.config.mjs rewrites()-based proxy that previously
// handled '/api/:path*'. That mechanism was returning empty-body 400s
// (bare nginx headers, Connection: close) from every business-data
// endpoint (GetUserStores, Order/List, CheckMetalRateForToday, Return/List,
// Exchange/List, BuyBack/List, ...) even with a freshly-issued, valid
// bearer token — while a hand-rolled route handler (api/auth/token/route.js)
// hitting the exact same upstream with the exact same token succeeded
// every time. Confirmed 2026-07-15 by piping one fresh token through both
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

  // connect/token needs client authentication for the live confidential
  // client — add HTTP Basic Auth using the client_id already present in
  // the form body (set client-side in appConfig.js, not secret) plus the
  // server-only secret. Never overrides an explicit Authorization header
  // the caller already set (e.g. a bearer token on other endpoints).
  if (isTokenEndpoint && CLIENT_SECRET && body && !headers.has('Authorization')) {
    const clientId = new URLSearchParams(body).get('client_id');
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
