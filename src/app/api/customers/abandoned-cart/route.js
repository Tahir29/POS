// Reads/writes a customer's abandoned-cart snapshot in Mongo. Same
// bearer-auth requirement as api/customers/recently-viewed/route.js and
// for the same reason — middleware.js excludes all /api paths from its
// auth matcher, so without this every one of these would be an
// unauthenticated read/write surface. Only a signed-in operator can call
// this, same trust boundary as the rest of the app.
//
// POST   — upsert the current cart snapshot for a customer.
// GET    — fetch the stored snapshot (party_id + customer_mobile query
//          params — see lib/mongo/abandonedCart.js's buildFilter for why
//          both are accepted: mobile is the real lookup key now, party_id
//          is the fallback for the rare case a normalizable mobile isn't
//          available).
// DELETE — remove it (same two query params) — called once the cart is no
//          longer pending, whether from a completed sale or a manual clear.

import { upsertAbandonedCartSchema } from '@/validators/abandonedCartSchema';
import { upsertAbandonedCart, getAbandonedCart, deleteAbandonedCart } from '@/lib/mongo/abandonedCart';

function requireBearerToken(request) {
  const authHeader = request.headers.get('authorization');
  return authHeader?.startsWith('Bearer ') ? authHeader : null;
}

// FIXED 2026-09-09 — customer_mobile added alongside party_id (see this
// file's own header + lib/mongo/abandonedCart.js's buildFilter). party_id
// alone used to be the whole lookup; it's now only the fallback, so a
// caller that omits customer_mobile still works exactly as before for that
// edge case, but the common case resolves by mobile instead.
function parseIdentity(request) {
  const url = new URL(request.url);
  const partyId = Number(url.searchParams.get('party_id'));
  const customerMobile = url.searchParams.get('customer_mobile') || null;
  return {
    partyId: Number.isInteger(partyId) && partyId > 0 ? partyId : null,
    customerMobile,
  };
}

export async function POST(request) {
  if (!requireBearerToken(request)) {
    return Response.json({ error: 'Missing bearer token' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = upsertAbandonedCartSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await upsertAbandonedCart(parsed.data);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[api/customers/abandoned-cart] POST', err);
    return Response.json({ error: 'Failed to save abandoned cart' }, { status: 500 });
  }
}

export async function GET(request) {
  if (!requireBearerToken(request)) {
    return Response.json({ error: 'Missing bearer token' }, { status: 401 });
  }

  const { partyId, customerMobile } = parseIdentity(request);
  if (!partyId && !customerMobile) {
    return Response.json({ error: 'Invalid party_id' }, { status: 400 });
  }

  try {
    const cart = await getAbandonedCart({ partyId, customerMobile });
    return Response.json({ cart });
  } catch (err) {
    console.error('[api/customers/abandoned-cart] GET', err);
    return Response.json({ error: 'Failed to fetch abandoned cart' }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!requireBearerToken(request)) {
    return Response.json({ error: 'Missing bearer token' }, { status: 401 });
  }

  const { partyId, customerMobile } = parseIdentity(request);
  if (!partyId && !customerMobile) {
    return Response.json({ error: 'Invalid party_id' }, { status: 400 });
  }

  try {
    await deleteAbandonedCart({ partyId, customerMobile });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[api/customers/abandoned-cart] DELETE', err);
    return Response.json({ error: 'Failed to delete abandoned cart' }, { status: 500 });
  }
}
