import { randomUUID } from 'crypto';
import { getSessionFromRequest } from '@/lib/ornaverse/session';
import { findShopifyCustomer } from '@/lib/shopify/adminCustomer';

// Server-side proxy for the Nector reviews + loyalty-points API.
// NECTOR_API_KEY/NECTOR_WEBHOOK_KEY authenticate as this store's merchant
// account and must never reach the browser; this route attaches them
// server-side and returns only the response body to the client.
//
// REQUEST:
//   GET  /api/nector/reviews?reference_product_source=shopify&reference_product_id=...
//   GET  /api/nector/reviews-count?reference_product_source=shopify&reference_product_id=...
//   GET  /api/nector/leads?mobile=...   — loyalty points lookup (legacy, see below)
//   POST /api/nector/wallettransactions — debit/credit (CONFIRMED DEAD, see below)
//   POST /api/nector/checkout           — list/perform a Lucira Coins redemption
//     body: { customer_id: "shopify-<numeric id>", action: "list"|"perform",
//             amount: <cart/order total, NOT the coin amount>,
//             reference_order_id?, wallet_type?: "coins" }
//
// Nector calls a customer record a "lead". GET leads/{id}?mobile=... looks
// a lead up by mobile, but {id} is a required-but-ignored path segment once
// a query param like mobile is present, so a fresh UUID is generated per
// request (see upstreamPath below). A 422 with data.message "Lead does not
// exists" is a normal outcome (no storefront activity for this customer
// yet), not an error — see nectorService.js's getCustomerLoyalty.
//
// CONFIRMED LIVE 2026-09-22 — wallettransactions (v2/merchant, NECTOR_API_KEY/
// NECTOR_SECRET_KEY) is the WRONG mechanism entirely: every payload 403s
// "need nector write access api key" regardless of shape or which credential
// is used. The REAL mechanism — read directly from the Shopify storefront's
// own live checkout backend — is the `checkout` path below: a completely
// separate integration ("Custom Checkout Webhook"), authenticated by
// NECTOR_WEBHOOK_KEY embedded in the URL (not x-apikey/x-workspaceid at
// all), identifying the customer as `shopify-<numeric Shopify customer id>`
// rather than any Nector-internal id. Confirmed against the real workspace:
// `action: "list"` returned a real balance + real redemption promotion; the
// `leads`/`wallettransactions` paths are kept only for the review-summary/
// balance-display code paths not yet migrated off them, not because they're
// a working alternative for redemption.

// cachefront.nector.io is a read/cache layer; platform.nector.io is used for
// the wallettransactions write so a balance change never goes through a
// stale-tolerant cache.
const NECTOR_READ_BASE  = 'https://cachefront.nector.io/api/v2/merchant';
const NECTOR_WRITE_BASE = 'https://platform.nector.io/api/v2/merchant';
const NECTOR_CHECKOUT_BASE = 'https://platform.nector.io/api/open/integrations/customcheckoutwebhook';
const NECTOR_APIKEY = process.env.NECTOR_API_KEY;
const NECTOR_WORKSPACE = process.env.NECTOR_WORKSPACE_ID;
const NECTOR_WEBHOOK_KEY = process.env.NECTOR_WEBHOOK_KEY;

// middleware.js excludes all /api paths from its auth matcher, so this
// route has no session check of its own — ALLOWED_PATHS keeps it from
// being a credentialed open proxy onto Nector's merchant namespace. Write
// paths additionally require a signed-in operator session (checked below)
// since a write moves a real customer's coin balance. `checkout` is gated
// even for its read ("list") action — unlike the storefront's own use of
// this same endpoint (customer-facing, no admin session exists), every
// caller here is an authenticated POS operator, so there's no UX cost to
// requiring it, and it keeps a real customer's balance behind a login.
const ALLOWED_PATHS = new Set(['reviews', 'reviews-count', 'leads', 'wallettransactions', 'checkout']);
const WRITE_PATHS = new Set(['wallettransactions', 'checkout']);

async function proxy(request, { params }) {
  const { path } = await params;

  if (path.length !== 1 || !ALLOWED_PATHS.has(path[0])) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const isCheckout = path[0] === 'checkout';

  if (isCheckout ? !NECTOR_WEBHOOK_KEY : (!NECTOR_APIKEY || !NECTOR_WORKSPACE)) {
    console.error(isCheckout
      ? '[Nector] Missing NECTOR_WEBHOOK_KEY env var'
      : '[Nector] Missing NECTOR_API_KEY or NECTOR_WORKSPACE_ID env vars');
    return new Response(JSON.stringify({ error: 'Nector not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (WRITE_PATHS.has(path[0]) && !(await getSessionFromRequest(request))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let targetUrl;
  if (isCheckout) {
    // The customer_id/action/amount live in the body, not the URL — nothing
    // else to build here.
    targetUrl = `${NECTOR_CHECKOUT_BASE}/${NECTOR_WEBHOOK_KEY}`;
  } else {
    // leads/{id} — id is required by Nector but ignored once a query param
    // (mobile) is present, so a fresh one is generated per request.
    const upstreamPath = path[0] === 'leads' ? `leads/${randomUUID()}` : path.join('/');
    const base = WRITE_PATHS.has(path[0]) ? NECTOR_WRITE_BASE : NECTOR_READ_BASE;
    targetUrl = `${base}/${upstreamPath}${request.nextUrl.search}`;
  }

  const hasBody = !['GET', 'HEAD'].includes(request.method);
  let body = hasBody ? await request.text() : undefined;

  // `customer_id` must be "shopify-<numeric Shopify customer id>" — the
  // client only ever has a mobile number, so resolve it server-side (same
  // Shopify Admin lookup shopify-sync uses) rather than expose the mapping
  // or an admin token to the browser. If a caller already sends
  // customer_id directly (e.g. a debug/manual test), it's passed through
  // unmodified.
  if (isCheckout && body) {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!parsed.customer_id && (parsed.mobile || parsed.email)) {
      const customer = await findShopifyCustomer({ mobile: parsed.mobile, email: parsed.email });
      if (!customer) {
        return new Response(JSON.stringify({ data: { message: 'No matching Shopify customer' } }), {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const { mobile: _mobile, email: _email, ...rest } = parsed;
      body = JSON.stringify({ ...rest, customer_id: `shopify-${customer.numericId}` });
    }
  }

  const upstreamRes = await fetch(targetUrl, {
    method: request.method,
    // The checkout webhook authenticates entirely via the key embedded in
    // the URL — confirmed live it does NOT want x-apikey/x-workspaceid (that
    // pair belongs to the separate v2/merchant API these other paths use).
    headers: isCheckout
      ? { 'x-source': 'web', 'Content-Type': 'application/json' }
      : {
          'x-apikey':      NECTOR_APIKEY,
          'x-workspaceid': NECTOR_WORKSPACE,
          'x-source':      'web',
          'Content-Type':  'application/json',
        },
    body,
    // Reviews change infrequently — cache briefly rather than hitting Nector
    // on every card render. Everything else (balance/redemption) is always
    // read fresh.
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
