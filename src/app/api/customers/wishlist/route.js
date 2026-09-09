// Reads/writes a customer's wishlist in Mongo. Same bearer-auth requirement
// as the other two customer-data routes (recently-viewed, abandoned-cart)
// and for the same reason — middleware.js excludes all /api paths from its
// auth matcher, so without this every one of these would be an
// unauthenticated read/write surface. Only a signed-in operator can call
// this, same trust boundary as the rest of the app.
//
// POST   — add one item to a customer's wishlist.
// GET    — fetch the full wishlist (party_id + customer_mobile query params
//          — see lib/mongo/wishlist.js's buildFilter: mobile is the real
//          lookup key now, party_id the fallback) — used both by
//          wishlistMiddleware (attached customer, for heart-icon state) and
//          by the customer profile page's Wishlist tab (any customer being
//          viewed, whether attached or not).
// DELETE — remove one item (same two identity params + item_id, plus an
//          optional item_size_id — see removeWishlistItem's own header for
//          why a wishlist entry's real identity is (item_id, item_size_id),
//          not item_id alone).

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

// FIXED 2026-09-09 — see this file's own header + lib/mongo/wishlist.js's
// buildFilter for why.
function parseMobileParam(url) {
  return new URL(url).searchParams.get('customer_mobile') || null;
}

// Distinct from parseIntParam above: an ABSENT item_size_id is the normal,
// valid case (the item's bare base design, no customization confirmed) —
// null here means "no size", not "missing/invalid param".
function parseOptionalIntParam(url, name) {
  const raw = new URL(url).searchParams.get(name);
  if (raw == null || raw === '') return null;
  const value = Number(raw);
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
  const customerMobile = parseMobileParam(request.url);
  if (!partyId && !customerMobile) {
    return Response.json({ error: 'Invalid party_id' }, { status: 400 });
  }

  try {
    const items = await getWishlist({ partyId, customerMobile });
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

  const partyId    = parseIntParam(request.url, 'party_id');
  const customerMobile = parseMobileParam(request.url);
  const itemId     = parseIntParam(request.url, 'item_id');
  const itemSizeId = parseOptionalIntParam(request.url, 'item_size_id');
  if ((!partyId && !customerMobile) || !itemId) {
    return Response.json({ error: 'Invalid party_id or item_id' }, { status: 400 });
  }

  try {
    await removeWishlistItem({ party_id: partyId, customerMobile, item_id: itemId, item_size_id: itemSizeId });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[api/customers/wishlist] DELETE', err);
    return Response.json({ error: 'Failed to remove from wishlist' }, { status: 500 });
  }
}
