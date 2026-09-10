// Mirrors a customer record into Mongo. Fire-and-forget from the client;
// see lib/mongo/customerProfile.js for what does (and does not) get stored.
//
// Only party_id is accepted from the client — the profile itself is always
// re-fetched server-side from OrnaVerse using the caller's own bearer token
// (Services/POS/Customer/Retrieve), never trusted from the request body.
// This also doubles as auth: an invalid/expired token is rejected by
// OrnaVerse itself before Mongo is touched.

import { customerProfileSchema } from '@/validators/customerProfileSchema';
import { upsertCustomerProfile } from '@/lib/mongo/customerProfile';
import { UPSTREAM } from '@/lib/ornaverse/upstream';

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
