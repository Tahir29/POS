// Records/lists walk-in events in our own Mongo — see lib/mongo/walkins.js
// for why this collection exists at all (OrnaVerse's own WalkIn/Lookup and
// /Register are both single-customer, no listing mode). Same bearer-auth
// requirement as api/customers/recently-viewed/route.js and for the same
// reason: middleware.js excludes all /api paths from its auth matcher, so
// without an explicit check here this would be an unauthenticated
// read/write surface.
//
// Deliberately simple, same reasoning as recently-viewed's own header: the
// POST payload is our own app-generated visit snapshot (see
// walkInSchema.js), not something re-verified against OrnaVerse — the
// worst a bad payload could do is add a junk row to this store's own log,
// which is low-severity and doesn't touch any OrnaVerse record.

import { recordWalkInSchema } from '@/validators/walkInSchema';
import { recordWalkIn, listWalkIns } from '@/lib/mongo/walkins';

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

  const parsed = recordWalkInSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await recordWalkIn(parsed.data);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[api/customers/walkins] POST', err);
    return Response.json({ error: 'Failed to record walk-in' }, { status: 500 });
  }
}

// GET ?company_id=&from=&to= — from/to are YYYY-MM-DD (native <input
// type="date"> value format, same convention orders/invoices already use
// for their own date-range filters), padded here to the start/end of that
// calendar day so the range is inclusive of both endpoints.
export async function GET(request) {
  if (!requireBearerToken(request)) {
    return Response.json({ error: 'Missing bearer token' }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const companyId = Number(params.get('company_id'));
  if (!Number.isInteger(companyId) || companyId <= 0) {
    return Response.json({ error: 'Invalid company_id' }, { status: 400 });
  }

  const fromParam = params.get('from');
  const toParam   = params.get('to');
  const fromDate  = fromParam ? new Date(`${fromParam}T00:00:00.000Z`) : null;
  const toDate    = toParam   ? new Date(`${toParam}T23:59:59.999Z`)   : null;

  try {
    const items = await listWalkIns({ company_id: companyId, fromDate, toDate });
    return Response.json({ items });
  } catch (err) {
    console.error('[api/customers/walkins] GET', err);
    return Response.json({ error: 'Failed to fetch walk-ins' }, { status: 500 });
  }
}
