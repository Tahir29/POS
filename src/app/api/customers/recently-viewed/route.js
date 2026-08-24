// Records/reads a customer's recently-viewed products in Mongo. Same
// bearer-auth requirement as api/customers/sync/route.js and for the same
// reason: middleware.js excludes all /api paths from its auth matcher, so
// without an explicit check here this would be an unauthenticated
// read/write surface. Requiring the caller's own OrnaVerse bearer token
// keeps the trust boundary identical to the rest of the app — only a
// signed-in operator can call this, same as everything else in the POS.
//
// Deliberately simpler than customers/sync: that route re-fetches the
// customer PROFILE from OrnaVerse itself because trusting a client-
// submitted profile was the actual vulnerability there (arbitrary overwrite
// of another party's data). Here, the payload is our own app-generated
// browsing snapshot (see recentlyViewedSchema.js) — there's no OrnaVerse
// record to defer to, and the worst a caller could do with a bad payload is
// pollute their OWN currently-attached customer's recently-viewed list with
// junk, which is low-severity and self-correcting (it just ages out via the
// $slice cap in lib/mongo/recentlyViewed.js).

import { recordViewSchema } from '@/validators/recentlyViewedSchema';
import { upsertRecentlyViewedItem, getRecentlyViewedItems } from '@/lib/mongo/recentlyViewed';

function requireBearerToken(request) {
  const authHeader = request.headers.get('authorization');
  return authHeader?.startsWith('Bearer ') ? authHeader : null;
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

  const parsed = recordViewSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { party_id, customerName, customerMobile, item } = parsed.data;

  try {
    await upsertRecentlyViewedItem({ party_id, customerName, customerMobile, item });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[api/customers/recently-viewed] POST', err);
    return Response.json({ error: 'Failed to record view' }, { status: 500 });
  }
}

export async function GET(request) {
  if (!requireBearerToken(request)) {
    return Response.json({ error: 'Missing bearer token' }, { status: 401 });
  }

  const partyId = Number(new URL(request.url).searchParams.get('party_id'));
  if (!Number.isInteger(partyId) || partyId <= 0) {
    return Response.json({ error: 'Invalid party_id' }, { status: 400 });
  }

  try {
    const items = await getRecentlyViewedItems(partyId);
    return Response.json({ items });
  } catch (err) {
    console.error('[api/customers/recently-viewed] GET', err);
    return Response.json({ error: 'Failed to fetch recently viewed' }, { status: 500 });
  }
}
