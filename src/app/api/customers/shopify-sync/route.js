// Pushes a POS-created customer to Shopify directly, including the phone
// number. CONFIRMED LIVE 2026-09-22: OrnaVerse's own Create-time push to
// Shopify creates the Shopify customer but drops phone entirely — which
// breaks Nector's lead lookup (our Lucira Coins balance is looked up by
// mobile, see nectorService.getCustomerLoyalty). This route is the fix:
// search for an existing Shopify customer by phone OR email first (since
// OrnaVerse's own async push may land before or after this one), and patch
// the phone onto it rather than duplicate/error, or create fresh with phone
// included from the start if nothing exists yet.
//
// Fire-and-forget from the client (see useCreateCustomer.js) — a Shopify
// failure here never blocks or reverses the OrnaVerse customer creation.

import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/ornaverse/session';
import { toE164India, shopifyGraphQL, shopifyConfigured, findShopifyCustomer } from '@/lib/shopify/adminCustomer';

const CREATE_MUTATION = `
  mutation CustomerCreate($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer { id }
      userErrors { field message }
    }
  }
`;

const UPDATE_MUTATION = `
  mutation CustomerUpdate($input: CustomerInput!) {
    customerUpdate(input: $input) {
      customer { id }
      userErrors { field message }
    }
  }
`;

export async function POST(request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (!shopifyConfigured()) {
    console.error('[shopify-sync] Missing SHOPIFY_STORE or SHOPIFY_ADMIN_TOKEN env vars');
    return NextResponse.json({ error: 'Shopify not configured' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { party_id, party_name, mobile, email } = body ?? {};
  const phone = toE164India(mobile);
  if (!phone && !email) {
    return NextResponse.json({ error: 'No phone or email to sync' }, { status: 400 });
  }

  try {
    const existing = await findShopifyCustomer({ mobile, email });

    if (existing) {
      if (existing.phone) {
        return NextResponse.json({ ok: true, action: 'skipped', shopifyId: existing.id });
      }
      const updateRes = await shopifyGraphQL(UPDATE_MUTATION, {
        input: { id: existing.id, phone },
      });
      const errors = updateRes?.data?.customerUpdate?.userErrors;
      if (errors?.length) {
        console.error('[shopify-sync] customerUpdate errors', errors);
        return NextResponse.json({ ok: false, error: errors }, { status: 502 });
      }
      return NextResponse.json({ ok: true, action: 'updated', shopifyId: existing.id });
    }

    const [firstName, ...rest] = String(party_name || '').trim().split(/\s+/);
    const createRes = await shopifyGraphQL(CREATE_MUTATION, {
      input: {
        firstName,
        lastName: rest.join(' ') || undefined,
        email:    email || undefined,
        phone:    phone || undefined,
        note:     party_id ? `OrnaVerse party_id: ${party_id}` : undefined,
        tags:     ['pos-created'],
      },
    });
    const errors = createRes?.data?.customerCreate?.userErrors;
    if (errors?.length) {
      console.error('[shopify-sync] customerCreate errors', errors);
      return NextResponse.json({ ok: false, error: errors }, { status: 502 });
    }
    return NextResponse.json({ ok: true, action: 'created', shopifyId: createRes?.data?.customerCreate?.customer?.id });

  } catch (err) {
    console.error('[shopify-sync] failed', err);
    return NextResponse.json({ ok: false, error: 'Shopify sync failed' }, { status: 500 });
  }
}
