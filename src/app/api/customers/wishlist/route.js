// Reads/writes a customer's wishlist in Mongo. Same bearer-auth requirement
// as the other two customer-data routes (recently-viewed, abandoned-cart)
// and for the same reason — middleware.js excludes all /api paths from its
// auth matcher, so without this every one of these would be an
// unauthenticated read/write surface. Only a signed-in operator can call
// this, same trust boundary as the rest of the app.
//
// POST   — add one item to a party_id's wishlist.
// GET    — fetch the full wishlist for a party_id (party_id query param) —
//          used both by wishlistMiddleware (attached customer, for heart-
//          icon state) and by the customer profile page's Wishlist tab
//          (any customer being viewed, whether attached or not).
// DELETE — remove one item (party_id + item_id query params).

import { addWishlistItemSchema } from '@/validators/wishlistSchema';
import { addWishlistItem, removeWishlistItem, getWishlist } from '@/lib/mongo/wishlist';

function requireBearerToken(request) {
  const authHeader = request.headers.get('authorization');
  return authHeader?.startsWith('Bearer ') ? authHeader : null;
}

function parseIntParam(url, name) {
  const value = Number(new URL(url).searchParams.get(name));
  return Number.isInteger(value) && value > 0 ? value : null;
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

  const parsed = addWishlistItemSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await addWishlistItem(parsed.data);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[api/customers/wishlist] POST', err);
    return Response.json({ error: 'Failed to add to wishlist' }, { status: 500 });
  }
}

export async function GET(request) {
  if (!requireBearerToken(request)) {
    return Response.json({ error: 'Missing bearer token' }, { status: 401 });
  }

  const partyId = parseIntParam(request.url, 'party_id');
  if (!partyId) {
    return Response.json({ error: 'Invalid party_id' }, { status: 400 });
  }

  try {
    const items = await getWishlist(partyId);
    return Response.json({ items });
  } catch (err) {
    console.error('[api/customers/wishlist] GET', err);
    return Response.json({ error: 'Failed to fetch wishlist' }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!requireBearerToken(request)) {
    return Response.json({ error: 'Missing bearer token' }, { status: 401 });
  }

  const partyId = parseIntParam(request.url, 'party_id');
  const itemId  = parseIntParam(request.url, 'item_id');
  if (!partyId || !itemId) {
    return Response.json({ error: 'Invalid party_id or item_id' }, { status: 400 });
  }

  try {
    await removeWishlistItem({ party_id: partyId, item_id: itemId });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[api/customers/wishlist] DELETE', err);
    return Response.json({ error: 'Failed to remove from wishlist' }, { status: 500 });
  }
}
