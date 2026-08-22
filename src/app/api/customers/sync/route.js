// src/app/api/customers/sync/route.js
//
// Mirrors a customer record into Mongo. Fire-and-forget from the client —
// never something a real sale waits on. See lib/mongo/customerProfile.js
// for what does (and does NOT — no PAN) get stored.
//
// SECURITY FIX 2026-08-21: this used to accept an arbitrary `profile` object
// straight from the request body with NO authentication at all — any caller
// who could reach this server could overwrite any party_id's stored profile
// with whatever they wanted, no login required. Confirmed via security
// review (see the "customers/sync" finding).
//
// Fixed by requiring the caller's own OrnaVerse bearer token (the same one
// already used for every other authenticated call in this app) and having
// THIS SERVER re-fetch the authoritative record from OrnaVerse itself —
// Services/POS/Customer/Retrieve, the same contract customerService.js's
// retrieveCustomer() already uses client-side — rather than trusting
// whatever the client claims a customer's profile is. Two birds: a caller
// without a valid token gets rejected (OrnaVerse itself 401s the retrieve
// call), and there is no longer an arbitrary-write surface — what gets
// stored is always exactly what OrnaVerse has for that party_id, which is
// no more than the caller could already see through the app's normal flows.

import { customerProfileSchema } from '@/validators/customerProfileSchema';
import { upsertCustomerProfile } from '@/lib/mongo/customerProfile';
import { UPSTREAM } from '@/lib/ornaverse/upstream';

// Only party_id comes from the client now — the profile itself is always
// fetched fresh, server-side, from the authenticated caller's own token.
const requestSchema = customerProfileSchema.pick({ party_id: true });

export async function POST(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Missing bearer token' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { party_id } = parsed.data;

  let retrieveRes;
  try {
    retrieveRes = await fetch(`${UPSTREAM}/Services/POS/Customer/Retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ EntityId: party_id }),
      cache: 'no-store',
    });
  } catch (err) {
    console.error('[api/customers/sync] upstream fetch failed', err);
    return Response.json({ error: 'Sync failed' }, { status: 502 });
  }

  // OrnaVerse itself is the authority on whether this token is valid — an
  // invalid/expired token, or a party_id the caller has no business
  // touching, is rejected right here, before Mongo is ever involved.
  if (!retrieveRes.ok) {
    const status = retrieveRes.status === 401 ? 401 : 502;
    return Response.json({ error: 'Could not verify customer with OrnaVerse' }, { status });
  }

  let entity;
  try {
    entity = (await retrieveRes.json())?.Entity;
  } catch {
    return Response.json({ error: 'Sync failed' }, { status: 502 });
  }
  if (!entity) {
    return Response.json({ error: 'Customer not found' }, { status: 404 });
  }

  try {
    await upsertCustomerProfile({ party_id, profile: entity });
    return Response.json({ ok: true, party_id });
  } catch (err) {
    console.error('[api/customers/sync]', err);
    return Response.json({ error: 'Sync failed' }, { status: 500 });
  }
}
