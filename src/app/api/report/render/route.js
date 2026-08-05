// src/app/api/report/render/route.js
//
// Renders an OrnaVerse document report (invoice, e-certificate, ...) and
// returns its HTML, so our POS can show it inline instead of bouncing the
// operator to OrnaVerse's own site.
//
// The generic proxy at api/[...path] can't do this: it forwards the caller's
// bearer token, and /Print/Render is cookie-authenticated and answers a
// bearer request with the login page. This route swaps in a server-held
// session instead — see lib/ornaverse/reportSession.js.
//
// Request  (JSON): { reportKey, opt, reportFile, reportFolder, reportSubFolder? }
//   opt — the report's own parameters, e.g. { transaction_id: 1207 }.
// Response: text/html on success, JSON { error } otherwise.
//
// Contract captured from their client (chunk-CJSQNCGC.js):
//   POST /Print/Render, application/x-www-form-urlencoded,
//   body { key, opt, reportFile, reportFolder, reportSubFolder },
//   plus X-CSRF-TOKEN from the CSRF-TOKEN cookie when present.

import { UPSTREAM } from '@/lib/ornaverse/upstream';
import {
  getReportSession,
  destroyReportSession,
  REPORT_SESSION_COOKIE,
} from '@/lib/ornaverse/reportSession';

/** Their login page comes back as HTML with this title when auth is refused. */
function isLoginPage(html) {
  return /<title>\s*Login to your account\s*<\/title>/i.test(html);
}

async function render(session, form) {
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Cookie: session.cookie,
  };
  if (session.csrf) headers['X-CSRF-TOKEN'] = session.csrf;

  const response = await fetch(`${UPSTREAM}/Print/Render`, {
    method: 'POST',
    headers,
    body:   new URLSearchParams(form).toString(),
    cache:  'no-store',
    redirect: 'manual',
  });

  return { status: response.status, html: await response.text() };
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { reportKey, opt, reportFile, reportFolder, reportSubFolder } = payload ?? {};
  if (!reportKey || !reportFile) {
    return Response.json({ error: 'reportKey and reportFile are required.' }, { status: 400 });
  }

  const form = {
    key:             reportKey,
    opt:             typeof opt === 'string' ? opt : JSON.stringify(opt ?? {}),
    reportFile,
    reportFolder:    reportFolder ?? '',
    reportSubFolder: reportSubFolder ?? '',
  };

  const sessionId = request.cookies?.get?.(REPORT_SESSION_COOKIE)?.value;
  const session = getReportSession(sessionId);

  // No session means this operator signed in before report printing existed,
  // or their session aged out. We can't re-login for them — the password was
  // never kept — so say what actually fixes it.
  if (!session) {
    return Response.json(
      { error: 'Your OrnaVerse print session has expired. Sign out and back in to print invoices.' },
      { status: 401 },
    );
  }

  try {
    const result = await render(session, form);

    // A rejected cookie doesn't 401 — it renders the login page with a
    // perfectly good 200. Drop the dead session so the operator is told to
    // sign in again rather than getting OrnaVerse's login form in an iframe.
    if (isLoginPage(result.html)) {
      destroyReportSession(sessionId);
      return Response.json(
        { error: 'Your OrnaVerse print session is no longer valid. Sign out and back in to print invoices.' },
        { status: 401 },
      );
    }

    if (result.status >= 400) {
      return Response.json(
        { error: `OrnaVerse could not render this report (HTTP ${result.status}).` },
        { status: 502 },
      );
    }

    return new Response(result.html, {
      status:  200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[report/render]', err);
    return Response.json({ error: 'Report rendering failed.' }, { status: 502 });
  }
}
