#!/usr/bin/env node
// scripts/backfillCustomerProfiles.mjs
//
// One-time (or re-run-safe) bulk backfill of every OrnaVerse customer into
// the Mongo `customers` collection. Without this, that collection only ever
// grows organically — src/hooks/customer/useCustomerLookup.js mirrors a
// customer in ONLY when an operator searches for them by mobile number
// (see its header comment), so a fresh Mongo connection legitimately starts
// with just the handful of customers someone happened to look up, not the
// whole directory.
//
// WHAT THIS DOES:
//   1. Pages through Services/POS/Customer/List (via this app's own
//      OrnaVerse proxy) to collect every party_id that exists.
//   2. For each party_id, calls the app's own already-secured
//      POST /api/customers/sync — the exact same route the mobile-lookup
//      flow already uses. That route re-fetches the authoritative record
//      from OrnaVerse itself and upserts it into Mongo (minus PAN — see
//      src/lib/mongo/customerProfile.js). This script adds NO new backend
//      code and NO new write path: it just calls that one endpoint once
//      per customer instead of waiting for organic mobile lookups to do it
//      one at a time over weeks.
//
// REQUIRES: the Next.js dev/prod server already running (this script talks
// to it over HTTP, not to Mongo or OrnaVerse directly), and a valid
// OrnaVerse bearer token for whichever environment that server is currently
// pointed at (src/lib/ornaverse/environment.js's ACTIVE_ENV) — same token
// the app itself uses, so if you're logged into the app in a browser
// already, you already have one:
//
//   Browser console, while logged into the app:
//     JSON.parse(JSON.parse(localStorage.getItem('persist:lucira-pos-root')).auth).accessToken
//
// USAGE:
//   node scripts/backfillCustomerProfiles.mjs --token <accessToken>
//   node scripts/backfillCustomerProfiles.mjs --token <accessToken> --base-url http://localhost:3000
//   TOKEN=<accessToken> node scripts/backfillCustomerProfiles.mjs
//
// Safe to re-run: every sync call is an upsert keyed on party_id (see
// upsertCustomerProfile), so running this twice just refreshes syncedAt on
// records that already exist rather than duplicating anything.

const args = process.argv.slice(2);

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const TOKEN    = getArg('--token') ?? process.env.TOKEN;
const BASE_URL = (getArg('--base-url') ?? process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const PAGE_SIZE   = 200; // Customer/List page size while collecting party_ids
const CONCURRENCY = 5;   // parallel /api/customers/sync calls at a time — gentle on OrnaVerse + Mongo

if (!TOKEN) {
  console.error('Missing --token (or TOKEN env var). See this script\'s header comment for how to grab one from a logged-in browser session.');
  process.exit(1);
}

async function listAllPartyIds() {
  const partyIds = [];
  let skip = 0;
  let total = Infinity;

  while (skip < total) {
    const res = await fetch(`${BASE_URL}/api/Services/POS/Customer/List`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ Take: PAGE_SIZE, Skip: skip }),
    });
    if (!res.ok) {
      throw new Error(`Customer/List failed at Skip=${skip}: HTTP ${res.status}`);
    }
    const data = await res.json();
    const entities = data?.Entities ?? [];
    total = data?.TotalCount ?? entities.length;

    for (const e of entities) {
      if (e?.party_id != null) partyIds.push(e.party_id);
    }

    skip += PAGE_SIZE;
    console.log(`  fetched ${Math.min(skip, total)}/${total} customer records...`);
  }

  return partyIds;
}

async function syncOne(partyId) {
  try {
    const res = await fetch(`${BASE_URL}/api/customers/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ party_id: partyId }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { partyId, ok: false, status: res.status, body: body.slice(0, 200) };
    }
    return { partyId, ok: true };
  } catch (err) {
    return { partyId, ok: false, status: null, body: err.message };
  }
}

// Simple fixed-concurrency pool — no extra dependency for a one-off script.
async function runWithConcurrency(items, worker, concurrency) {
  const results = [];
  let nextIndex = 0;

  async function runNext() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await worker(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runNext));
  return results;
}

async function main() {
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Step 1/2 — collecting every party_id from Services/POS/Customer/List...');
  const partyIds = await listAllPartyIds();
  console.log(`Found ${partyIds.length} customers.\n`);

  console.log(`Step 2/2 — mirroring each into Mongo via /api/customers/sync (concurrency ${CONCURRENCY})...`);
  let done = 0;
  const results = await runWithConcurrency(partyIds, async (partyId) => {
    const result = await syncOne(partyId);
    done += 1;
    if (done % 50 === 0 || done === partyIds.length) {
      console.log(`  synced ${done}/${partyIds.length}...`);
    }
    return result;
  }, CONCURRENCY);

  const failed = results.filter((r) => !r.ok);

  console.log('\n=== Summary ===');
  console.log(`Total customers: ${partyIds.length}`);
  console.log(`Synced OK:       ${partyIds.length - failed.length}`);
  console.log(`Failed:          ${failed.length}`);

  if (failed.length > 0) {
    console.log('\nFailed party_ids (first 20 shown):');
    for (const f of failed.slice(0, 20)) {
      console.log(`  party_id=${f.partyId} status=${f.status} ${f.body}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
