// Reads/writes a customer's abandoned-cart snapshot in Mongo. Same
// bearer-auth requirement as api/customers/recently-viewed/route.js and
// for the same reason — middleware.js excludes all /api paths from its
// auth matcher, so without this every one of these would be an
// unauthenticated read/write surface. Only a signed-in operator can call
// this, same trust boundary as the rest of the app.
//
// POST   — upsert the current cart snapshot for a party_id.
// GET    — fetch the stored snapshot for a party_id (party_id query param).
// DELETE — remove it (party_id query param) — called once the cart is no
//          longer pending, whether from a completed sale or a manual clear.

import { upsertAbandonedCartSchema } from '@/validators/abandonedCartSchema';
import { upsertAbandonedCart, getAbandonedCart, deleteAbandonedCart } from '@/lib/mongo/abandonedCart';

function requireBearerToken(request) {
  const authHeader = request.headers.get('authorization');
  return authHeader?.startsWith('Bearer ') ? authHeader : null;
}

function parsePartyId(request) {
  const partyId = Number(new URL(request.url).searchParams.get('party_id'));
  return Number.isInteger(partyId) && partyId > 0 ? partyId : null;
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

  const partyId = parsePartyId(request);
  if (!partyId) {
    return Response.json({ error: 'Invalid party_id' }, { status: 400 });
  }

  try {
    const cart = await getAbandonedCart(partyId);
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

  const partyId = parsePartyId(request);
  if (!partyId) {
    return Response.json({ error: 'Invalid party_id' }, { status: 400 });
  }

  try {
    await deleteAbandonedCart(partyId);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[api/customers/abandoned-cart] DELETE', err);
    return Response.json({ error: 'Failed to delete abandoned cart' }, { status: 500 });
  }
}
