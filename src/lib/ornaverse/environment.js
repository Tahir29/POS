// src/lib/ornaverse/environment.js
//
// The ONE flag that says which OrnaVerse environment this deployment
// targets. Deliberately its own tiny file, not part of upstream.js: this
// file contains no secrets and no process.env reads at all, so it's safe
// to import from client-side code (appConfig.js → authConfig.js, read by
// LoginForm/authService.js) as well as server-only code (upstream.js).
// upstream.js is marked SERVER-ONLY specifically because it also computes
// CLIENT_SECRET from a server env var — importing that file from client
// code would pull that computation into the client module graph even
// though the secret's value itself can't reach the browser (Next only
// inlines NEXT_PUBLIC_-prefixed vars into client bundles; anything else
// resolves to undefined there). This file exists so nothing client-facing
// ever needs to import upstream.js just to read the flag.
//
// Change ACTIVE_ENV here to switch environments everywhere at once:
//   - upstream.js       (server) → upstream URL + injected client secret
//   - authConfig.js      (client-safe) → client_id / grant_type / scope
export const ACTIVE_ENV = 'UAT'; // 'LIVE' | 'UAT'
