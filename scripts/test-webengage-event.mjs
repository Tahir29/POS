#!/usr/bin/env node
// scripts/test-webengage-event.mjs
//
// Sends ONE test event through the app's own /api/analytics/webengage route
// — the exact same path every real tracker.track()/trackAgent() call now
// uses (see src/lib/analytics/webengageBridge.js and webengageServer.js) —
// and prints the raw HTTP response, so you can confirm it landed in the
// WebEngage panel.
//
// That route requires an authenticated operator session (same as every
// other internal API route in this app), so this script logs in first,
// exactly like the app's own login form does — credentials are read from
// env vars only, never hardcoded or written anywhere.
//
// REQUIRES: the Next.js dev/prod server already running locally.
// USAGE:
//   POS_TEST_USER=<username> POS_TEST_PASS=<password> node scripts/test-webengage-event.mjs [baseUrl]

const baseUrl = process.argv[2] ?? 'http://localhost:3000';
const username = process.env.POS_TEST_USER;
const password = process.env.POS_TEST_PASS;

if (!username || !password) {
  console.error('Set POS_TEST_USER and POS_TEST_PASS env vars (same credentials you log into the POS with).');
  process.exit(1);
}

function parseCookies(response) {
  const raw = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  const pairs = [];
  for (const entry of raw) {
    const pair = entry.split(';')[0].trim();
    if (pair) pairs.push(pair);
  }
  return pairs;
}

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/session`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Login failed: ${response.status} ${body}`);
  }
  return parseCookies(response).join('; ');
}

async function main() {
  console.log('Logging in...');
  const cookie = await login();
  console.log('Login OK.');

  const response = await fetch(`${baseUrl}/api/analytics/webengage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      eventName: 'POS_TEST_EVENT',
      userId:    'test-user-script',
      properties: {
        testRun:       true,
        triggeredFrom: 'test-webengage-event.mjs',
        sampleAmount:  1234.5,
        cartValue:     999,
      },
    }),
  });

  const text = await response.text();
  console.log('\nHTTP', response.status, response.statusText);
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text);
  }

  if (response.ok) {
    console.log('\nSent. Look for event_type "Test_Event" under userId "test-user-script" in the WebEngage panel.');
  }
}

main().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
