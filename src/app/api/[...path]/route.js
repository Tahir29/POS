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

const UPSTREAM = (process.env.NEXT_PUBLIC_ORNAVERSE_BASE_URL_UAT || '').replace(/\/+$/, '');

async function proxy(request, { params }) {
  const { path } = await params;
  const targetUrl = `${UPSTREAM}/${path.join('/')}${request.nextUrl.search}`;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  const authorization = request.headers.get('authorization');
  if (authorization) headers.set('Authorization', authorization);

  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const body = hasBody ? await request.text() : undefined;

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
