// src/app/api/nector/[...path]/route.js
//
// Server-side proxy for the Nector reviews API.
//
// WHY THIS EXISTS:
//   NECTOR_API_KEY authenticates as this store's merchant account — it must
//   never be exposed to the browser. This route runs on the Next.js server,
//   forwards the request to Nector with the required auth headers, and
//   returns only the response body to the client.
//
// REQUEST:
//   GET /api/nector/reviews?reference_product_source=shopify&reference_product_id=...
//   GET /api/nector/reviews-count?reference_product_source=shopify&reference_product_id=...
//
// Confirmed live against the real Nector account 2026-07-19 (public docs at
// nector.stoplight.io don't document response bodies at all):
//   GET /reviews       → { meta, data: { items[], count, cursor, stats[] } }
//     items[]: { _id, name, rating, description, is_verified, posted_at, ... }
//   GET /reviews-count  → { meta, data: { countsum: { count, sum } } }
//     average rating = sum / count
//
// Auth: x-apikey (NECTOR_API_KEY) + x-workspaceid (NECTOR_WORKSPACE_ID) +
// x-source: web — confirmed working with NECTOR_API_KEY (not the SECRET_KEY,
// which is left unused here and never sent to the browser either way).

const NECTOR_BASE   = 'https://cachefront.nector.io/api/v2/merchant';
const NECTOR_APIKEY = process.env.NECTOR_API_KEY;
const NECTOR_WORKSPACE = process.env.NECTOR_WORKSPACE_ID;

async function proxy(request, { params }) {
  const { path } = await params;

  if (!NECTOR_APIKEY || !NECTOR_WORKSPACE) {
    console.error('[Nector] Missing NECTOR_API_KEY or NECTOR_WORKSPACE_ID env vars');
    return new Response(JSON.stringify({ error: 'Nector not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const targetUrl = `${NECTOR_BASE}/${path.join('/')}${request.nextUrl.search}`;

  const upstreamRes = await fetch(targetUrl, {
    method: request.method,
    headers: {
      'x-apikey':      NECTOR_APIKEY,
      'x-workspaceid': NECTOR_WORKSPACE,
      'x-source':      'web',
      'Content-Type':  'application/json',
    },
    // Reviews are user-facing content that can go a while between changes —
    // let the platform cache this for a bit rather than hitting Nector on
    // every single card render.
    next: { revalidate: 300 },
  });

  const body = await upstreamRes.arrayBuffer();
  return new Response(body, {
    status: upstreamRes.status,
    headers: {
      'Content-Type': upstreamRes.headers.get('content-type') ?? 'application/json',
    },
  });
}

export { proxy as GET };
