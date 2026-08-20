// src/lib/security/rateLimit.js
//
// In-memory rate limiter — built specifically to close the SEC-004 gap
// found live 2026-08-18: the login form's 5-attempt/5-minute lockout is
// React state only, so it protects nothing once a caller skips the UI and
// scripts requests straight at POST /api/connect/token. That endpoint is
// also where the proxy (route.js) attaches the app's confidential OAuth
// client secret on LIVE, so an unthrottled attacker gets unlimited password
// guesses AND a free credential to make each guess with. This module is
// what route.js calls to close that off — see the "SEC-004 hardening"
// comment there for how it's wired in.
//
// WHY IN-MEMORY, NOT REDIS/UPSTASH: there's no shared-cache infra in this
// repo today (no vercel.json, no Redis client in package.json), and this
// app runs as one `next start` process — confirmed via package.json's
// scripts (no serverless/edge config). A single process's memory is a
// perfectly correct place for a counter that only that process needs to
// see.
//
// DEPLOYMENT CAVEAT — reread this before changing how the app is hosted:
// if this ever moves to multiple concurrent instances (Vercel serverless
// functions, PM2 cluster mode, k8s replicas, ...), each instance keeps its
// OWN counter, so the effective limit silently multiplies by instance
// count and this stops being a real limit. If that happens, swap the Map
// below for a shared store (Redis/Upstash) behind the exact same
// checkRateLimit() signature — nothing calling this needs to change, same
// "swap one file" pattern used for webengageServer.js's future-scope note.
//
// Also resets on every deploy/restart (memory is wiped clean) — acceptable
// for a login throttle; worst case is one extra idle attempt window right
// after a deploy, not a real weakening of the protection.

const buckets = new Map(); // key -> { count, windowStart }

// Lazily sweep expired entries so a long-running process doesn't accumulate
// one Map entry per distinct (ip[:username]) forever. Runs at most once per
// SWEEP_INTERVAL_MS, piggybacking on whatever call happens to land after
// that much time has passed — no timer/interval needed.
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;

function sweep(now) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > SWEEP_INTERVAL_MS) buckets.delete(key);
  }
}

/**
 * Fixed-window rate check — call once per attempt. Every call counts
 * against the window, whether the attempt that triggered it ultimately
 * succeeds or fails (see route.js for why that's the right call for a
 * login endpoint: the point is to cap the number of GUESSES, not just the
 * number of wrong ones).
 *
 * @param {string} key — caller-chosen identity, e.g. `${ip}:${username}`
 * @param {{ limit: number, windowMs: number }} opts
 * @returns {{ allowed: boolean, retryAfterSeconds: number }}
 */
export function checkRateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.windowStart + windowMs - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Best-effort client IP for a Next.js Request — used only to key the
 * limiter above, never for anything security-critical beyond that (it's
 * trivially spoofable by a caller not behind a real reverse proxy). Behind
 * Vercel/nginx/any standard reverse proxy this is the real client address;
 * direct connections without one collapse to the 'unknown' bucket, which
 * still rate-limits (just as one shared bucket) rather than not at all.
 *
 * @param {Request} request
 * @returns {string}
 */
export function getClientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  return 'unknown';
}
