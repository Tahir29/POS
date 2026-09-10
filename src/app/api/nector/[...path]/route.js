import { randomUUID } from 'crypto';

// Server-side proxy for the Nector reviews + loyalty-points API.
// NECTOR_API_KEY authenticates as this store's merchant account and must
// never reach the browser; this route attaches it server-side and returns
// only the response body to the client.
//
// REQUEST:
//   GET  /api/nector/reviews?reference_product_source=shopify&reference_product_id=...
//   GET  /api/nector/reviews-count?reference_product_source=shopify&reference_product_id=...
//   GET  /api/nector/leads?mobile=...   — loyalty points lookup
//   POST /api/nector/wallettransactions — debit/credit Lucira Coins
//
// Nector calls a customer record a "lead". GET leads/{id}?mobile=... looks
// a lead up by mobile, but {id} is a required-but-ignored path segment once
// a query param like mobile is present, so a fresh UUID is generated per
// request (see upstreamPath below) — nectorService.js never needs to know
// about that quirk. A 422 with data.message "Lead does not exists" is a
// normal outcome (no storefront activity for this customer yet), not an
// error — see nectorService.js's getCustomerLoyalty.
//
// wallettransactions body is best-effort: Nector's docs want lead_id or
// customer_id (the lead's own _id / merchant-assigned id), but the leads
// lookup response never returns either field — only entity_id (shared
// across leads, not unique) and long hashes `mid`/`eid`. redeemLoyaltyCoins()
// sends `mid` as lead_id as the closest candidate; this is unconfirmed and
// may need correction once Nector support clarifies it. See checkout/page.jsx
// for how a failure here is handled (it never blocks or reverses the sale).

// cachefront.nector.io is a read/cache layer; platform.nector.io is used for
// the wallettransactions write so a balance change never goes through a
// stale-tolerant cache.
const NECTOR_READ_BASE  = 'https://cachefront.nector.io/api/v2/merchant';
const NECTOR_WRITE_BASE = 'https://platform.nector.io/api/v2/merchant';
const NECTOR_APIKEY = process.env.NECTOR_API_KEY;
const NECTOR_WORKSPACE = process.env.NECTOR_WORKSPACE_ID;

// middleware.js excludes all /api paths from its auth matcher, so this
// route has no session check of its own — ALLOWED_PATHS keeps it from
// being a credentialed open proxy onto Nector's merchant namespace. Write
// paths additionally require a bearer token from this app's own OrnaVerse
// login (checked below) since a write moves a real customer's coin balance.
const ALLOWED_PATHS = new Set(['reviews', 'reviews-count', 'leads', 'wallettransactions']);
const WRITE_PATHS = new Set(['wallettransactions']);

async function proxy(request, { params }) {
  const { path } = await params;

  if (path.length !== 1 || !ALLOWED_PATHS.has(path[0])) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!NECTOR_APIKEY || !NECTOR_WORKSPACE) {
    console.error('[Nector] Missing NECTOR_API_KEY or NECTOR_WORKSPACE_ID env vars');
    return new Response(JSON.stringify({ error: 'Nector not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (WRITE_PATHS.has(path[0]) && !request.headers.get('authorization')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // leads/{id} — id is required by Nector but ignored once a query param
  // (mobile) is present, so a fresh one is generated per request.
  const upstreamPath = path[0] === 'leads' ? `leads/${randomUUID()}` : path.join('/');
  const base = WRITE_PATHS.has(path[0]) ? NECTOR_WRITE_BASE : NECTOR_READ_BASE;
  const targetUrl = `${base}/${upstreamPath}${request.nextUrl.search}`;

  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const body = hasBody ? await request.text() : undefined;

  const upstreamRes = await fetch(targetUrl, {
    method: request.method,
    headers: {
      'x-apikey':      NECTOR_APIKEY,
      'x-workspaceid': NECTOR_WORKSPACE,
      'x-source':      'web',
      'Content-Type':  'application/json',
    },
    body,
    // Reviews change infrequently — cache briefly rather than hitting Nector
    // on every card render. leads/wallettransactions are always read fresh.
    ...(path[0] === 'reviews' || path[0] === 'reviews-count'
      ? { next: { revalidate: 300 } }
      : { cache: 'no-store' }),
  });

  const responseBody = await upstreamRes.arrayBuffer();
  return new Response(responseBody, {
    status: upstreamRes.status,
    headers: {
      'Content-Type': upstreamRes.headers.get('content-type') ?? 'application/json',
    },
  });
}

export { proxy as GET, proxy as POST };
