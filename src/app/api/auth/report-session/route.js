// Establishes (POST) or tears down (DELETE) the operator's OrnaVerse cookie
// session, used only for rendering invoice reports.
//
// Called right after a successful POS sign-in with the SAME credentials that
// just went to connect/token — they already pass through this server, so this
// spends them once more and keeps only the resulting cookie. Nothing is
// stored. See lib/ornaverse/reportSession.js for the full rationale.
//
// The session id goes back as an httpOnly cookie on OUR origin, so the
// browser attaches it to /api/report/render automatically and no script can
// read it. The client never sees the OrnaVerse cookie itself.
//
// Failure here is NOT fatal to signing in: everything except invoice
// printing works without it, so the caller is expected to treat a non-OK
// response as "printing unavailable", not "login failed".

import {
  createReportSession,
  destroyReportSession,
  REPORT_SESSION_COOKIE,
} from '@/lib/ornaverse/reportSession';

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

  try {
    const sessionId = await createReportSession({ username, password });
    const response = Response.json({ ok: true });
    response.headers.append(
      'Set-Cookie',
      `${REPORT_SESSION_COOKIE}=${sessionId}; HttpOnly; Path=/; SameSite=Lax${
        COOKIE_OPTIONS.secure ? '; Secure' : ''
      }`,
    );
    return response;
  } catch (err) {
    // Deliberately terse: this endpoint receives a password, so its errors
    // must never echo the request back in any form.
    console.error('[auth/report-session]', err?.code ?? 'ERROR', err?.message);
    const status = err?.code === 'BAD_REQUEST' ? 400 : 502;
    return Response.json({ ok: false, code: err?.code ?? 'LOGIN_FAILED' }, { status });
  }
}

export async function DELETE(request) {
  const sessionId = request.cookies?.get?.(REPORT_SESSION_COOKIE)?.value
    ?? parseCookieHeader(request.headers.get('cookie'))[REPORT_SESSION_COOKIE];

  destroyReportSession(sessionId);

  const response = Response.json({ ok: true });
  response.headers.append(
    'Set-Cookie',
    `${REPORT_SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
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
