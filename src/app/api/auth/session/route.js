// Establishes (POST) or tears down (DELETE) the operator's real OrnaVerse
// cookie session — this app's ONE authentication mechanism as of the
// 2026-09 auth rewire (see lib/ornaverse/session.js for the full why). The
// session id goes back as an httpOnly cookie on our own origin so the
// browser attaches it to every subsequent request automatically and no
// script can read the underlying OrnaVerse cookie.
//
// Rate-limited the same way the old OAuth connect/token password grant was
// (SEC-004) — this is now the one unauthenticated, credential-guessing call
// this app accepts.

import {
  createOrnaverseSession,
  destroyOrnaverseSession,
  SESSION_COOKIE,
} from '@/lib/ornaverse/session';
import { checkRateLimit, getClientIp } from '@/lib/security/rateLimit';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  path:     '/',
  // Dev runs on plain http://localhost, where a Secure cookie is dropped.
  secure:   process.env.NODE_ENV === 'production',
};

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { username, password } = payload ?? {};

  const ip = getClientIp(request);
  const normalizedUsername = String(username ?? '').trim().toLowerCase();
  const perAccount = checkRateLimit(`login:${ip}:${normalizedUsername}`, { limit: 5, windowMs: 5 * 60 * 1000 });
  const perIp = checkRateLimit(`login-ip:${ip}`, { limit: 20, windowMs: 5 * 60 * 1000 });

  if (!perAccount.allowed || !perIp.allowed) {
    const retryAfterSeconds = Math.max(perAccount.retryAfterSeconds, perIp.retryAfterSeconds);
    return Response.json(
      { error: 'too_many_attempts', error_description: 'Too many login attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
    );
  }

  try {
    const sessionId = await createOrnaverseSession({ username, password });
    const response = Response.json({ ok: true, username });
    response.headers.append(
      'Set-Cookie',
      `${SESSION_COOKIE}=${sessionId}; HttpOnly; Path=/; SameSite=Lax${
        COOKIE_OPTIONS.secure ? '; Secure' : ''
      }`,
    );
    return response;
  } catch (err) {
    // Deliberately terse: this endpoint receives a password, so its errors
    // must never echo the request back in any form.
    console.error('[auth/session]', err?.code ?? 'ERROR', err?.message);
    const status = err?.code === 'BAD_REQUEST' ? 400 : 401;
    return Response.json({ ok: false, code: err?.code ?? 'LOGIN_FAILED' }, { status });
  }
}

export async function DELETE(request) {
  const sessionId = request.cookies?.get?.(SESSION_COOKIE)?.value
    ?? parseCookieHeader(request.headers.get('cookie'))[SESSION_COOKIE];

  await destroyOrnaverseSession(sessionId);

  const response = Response.json({ ok: true });
  response.headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
  );
  return response;
}

function parseCookieHeader(header) {
  const out = {};
  for (const part of (header ?? '').split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name) out[name] = rest.join('=');
  }
  return out;
}
