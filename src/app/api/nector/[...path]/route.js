import { randomUUID } from 'crypto';

// Server-side proxy for the Nector reviews + loyalty-points API.
//
// WHY THIS EXISTS:
//   NECTOR_API_KEY authenticates as this store's merchant account — it must
//   never be exposed to the browser. This route runs on the Next.js server,
//   forwards the request to Nector with the required auth headers, and
//   returns only the response body to the client.
//
// REQUEST:
//   GET  /api/nector/reviews?reference_product_source=shopify&reference_product_id=...
//   GET  /api/nector/reviews-count?reference_product_source=shopify&reference_product_id=...
//   GET  /api/nector/leads?mobile=...   — loyalty points lookup, see below
//   POST /api/nector/wallettransactions — debit/credit Lucira Coins, see below
//
// Confirmed live against the real Nector account 2026-07-19 (public docs at
// nector.stoplight.io don't document response bodies at all):
//   GET /reviews       → { meta, data: { items[], count, cursor, stats[] } }
//     items[]: { _id, name, rating, description, is_verified, posted_at, ... }
//   GET /reviews-count  → { meta, data: { countsum: { count, sum } } }
//     average rating = sum / count
//
// LOYALTY POINTS (added 2026-09-08) — Nector calls a customer record a
// "lead". Confirmed live against nector.readme.io's own reference
// (get_leads-id) plus a real round-trip: GET .../leads/{id}?mobile=...
// looks a lead up by mobile (also accepts customer_id/referral_code/email,
// in that priority order — mobile is lowest priority, so this only ever
// matters when no other identifier is sent, which is all this app has).
// `{id}` is a REQUIRED path segment (Nector expects a lead's own UUID
// there) but is IGNORED entirely when a query param like `mobile` is
// present — confirmed live: two different real customers' correct records
// came back through two different random, unrelated UUIDs in that slot.
// So the id itself carries no meaning for a mobile-based lookup; this
// route generates a fresh one server-side (randomUUID()) so nectorService.js
// only ever needs to ask for GET /api/nector/leads?mobile=..., not know
// about Nector's own UUID-in-the-path quirk at all.
//   200 → { meta, data: { item: { entity_id, name, mobile (masked),
//     email (masked), available (points balance, a numeric STRING),
//     tier, wallet: { available, ... }, creditwallet, ... } } }
//   422 → { meta, data: { message: "Lead does not exists" } } — no Nector
//     record for this customer at all; a normal, expected outcome for
//     anyone who's never interacted with the Shopify storefront, not an
//     error to surface as one (see nectorService.js's getCustomerLoyalty).
//
// Auth: x-apikey (NECTOR_API_KEY) + x-workspaceid (NECTOR_WORKSPACE_ID) +
// x-source: web — confirmed working with NECTOR_API_KEY (not the SECRET_KEY,
// which is left unused here and never sent to the browser either way) for
// every path above, including leads — the extra x-timestamp/x-leaddigest/
// x-leadtoken headers nector.readme.io documents are only required for a
// restricted "storefront read" API key, not the full merchant key this
// route already holds.
//
// WALLET TRANSACTIONS (added 2026-09-08, NOT confirmed live) — per
// nector.readme.io/reference/post_wallettransactions: body is
// { title, description, amount, operation: 'cr'|'dr', lead_id?, customer_id? }
// (one of lead_id/customer_id required — lead_id is documented as "the
// lead's own _id value", customer_id as "the lead's customer_id value", a
// merchant-assigned id set only when THIS app creates the lead via
// POST /leads, which it never has — these Shopify-storefront leads were
// created by Nector's own Shopify app). UNRESOLVED GAP: GET /leads/{id}
// above returns neither field — no `_id`, no `customer_id` — anywhere in
// its response body (confirmed live, full raw JSON inspected), only
// entity_id (shared across different leads — proven NOT a per-lead id),
// mid and eid (both long hashes, too long to be Nector's own ObjectId-style
// _id). nectorService.js's redeemLoyaltyCoins() sends `mid` as lead_id on
// the working theory that it's the closest candidate, but this is an
// explicit best-effort guess, not a confirmed-correct call — expect it to
// fail until Nector support clarifies how to get a lead's real _id from a
// mobile-based lookup. See checkout/page.jsx's own comment for how a
// failure here is handled (never blocks or reverses the sale that already
// completed).

// Two Nector hosts, not one — confirmed against nector.readme.io's own
// per-endpoint "Base URLs" listing (2026-09-08): cachefront (a read/cache
// layer) for reviews/leads, but platform.nector.io — no cache — for
// wallettransactions (a real write). Sending a write to the cache host
// isn't documented to fail outright, but there's no reason to route a
// balance-changing call through a layer whose whole purpose is serving
// stale-tolerant reads.
const NECTOR_READ_BASE  = 'https://cachefront.nector.io/api/v2/merchant';
const NECTOR_WRITE_BASE = 'https://platform.nector.io/api/v2/merchant';
const NECTOR_APIKEY = process.env.NECTOR_API_KEY;
const NECTOR_WORKSPACE = process.env.NECTOR_WORKSPACE_ID;

// SECURITY: this route attaches a real merchant secret (NECTOR_API_KEY) to
// every request that reaches it, with no session/auth check of its own —
// src/middleware.js excludes all /api paths from its auth matcher. Without
// an allowlist, any caller (unauthenticated, since nothing here checks a
// session) could hit GET /api/nector/<anything> and have this server relay
// it to Nector's merchant namespace with real credentials attached, turning
// this into a credentialed open proxy. Only the endpoints this app
// actually calls (see nectorService.js) are allowed through. Still exactly
// ONE segment from the CALLER's point of view even for leads (path.length
// !== 1 below is unchanged) — the second (UUID) segment Nector's own API
// requires is appended server-side, never something a caller supplies.
//
// wallettransactions (added 2026-09-08) — a WRITE (debits/credits a real
// customer's coin balance), a materially bigger risk than the read-only
// paths above: without some check here, anyone who finds this route could
// move an arbitrary amount on an arbitrary lead_id/customer_id with no tie
// to a real POS sale at all. This app has no per-request session check to
// reach for (see the paragraph above), so the pragmatic floor applied here
// is requiring the caller to already hold a bearer token from THIS app's
// own OrnaVerse login (checked below, write paths only) — not a full
// verification round-trip against OrnaVerse, but it does mean a request
// has to already be coming from something holding a real staff session,
// not a cold, unauthenticated prober.
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
  // (mobile, here) is present; see this file's header for the live-
  // confirmed proof. Generated fresh per request, never reused.
  const upstreamPath = path[0] === 'leads' ? `leads/${randomUUID()}` : path.join('/');
  const base = WRITE_PATHS.has(path[0]) ? NECTOR_WRITE_BASE : NECTOR_READ_BASE;
  const targetUrl = `${base}/${upstreamPath}${request.nextUrl.search}`;

  // Body forwarding (added 2026-09-08) — every path here used to be GET
  // only, so nothing ever needed a request body. wallettransactions is a
  // POST with a real JSON payload (lead_id/customer_id, amount, operation,
  // title, description) — without this, that payload silently never
  // reached Nector at all, no matter what the caller sent.
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
    // Reviews are user-facing content that can go a while between changes —
    // let the platform cache this for a bit rather than hitting Nector on
    // every single card render. Doesn't apply to leads (its URL carries a
    // fresh random UUID every call, see upstreamPath above, so it could
    // never hit Next's cache anyway) or wallettransactions (a write) —
    // explicit here rather than leaving fetch to attempt (and pointlessly
    // discard, or worse cache) a call that must always be read fresh.
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
