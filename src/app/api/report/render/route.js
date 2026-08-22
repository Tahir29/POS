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

// CONFIRMED 2026-08-21: some report templates ("New Invoice Format" and
// "New Invoice Format WO Header", specifically — "E Certificate" is fine)
// fail server-side on OrnaVerse's end with a 200 OK and this literal
// sentence as the entire body — a genuine broken FastReport template on
// their side, reproduced even on an old, previously-proven invoice, so
// not something tied to a specific sale's data. A 200 with this body would
// otherwise sail through as if it were real report HTML and show the
// operator a near-blank iframe with no explanation.
function isReportGenerationError(html) {
  return html.trim() === 'An error occurred while generating the report';
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

    // See isReportGenerationError() above — this is OrnaVerse's own report
    // template failing, not a session problem, so don't destroy the
    // session over it (the operator's next report may render fine).
    if (isReportGenerationError(result.html)) {
      return Response.json(
        { error: 'This report format is currently broken on OrnaVerse’s side — try a different format, or ask OrnaVerse to fix this template.' },
        { status: 502 },
      );
    }

    if (result.status >= 400) {
      return Response.json(
        { error: `OrnaVerse could not render this report (HTTP ${result.status}).` },
        { status: 502 },
      );
    }

    // OrnaVerse's response is a bare fragment — no <html>/<head> at all,
    // confirmed live (starts straight at `<div class="fr...-container">`).
    // It carries inline <script> tags (the FastReport viewer's own JS —
    // without them the report never finishes initialising, which is why it
    // was rendering as a permanently-loading blank preview — see the
    // matching sandbox="allow-scripts" change in InvoiceReportButton) and
    // CSS/JS with ROOT-RELATIVE URLs like `/_fr/resources.getResource?...`
    // and `/_fr/preview.getReport?...`.
    //
    // CHANGED 2026-08-21: this used to add <base href="UPSTREAM/"> so those
    // resolved to OrnaVerse directly — fixed the resource 404, but then the
    // viewer's own follow-up XHR call ALSO resolved there and hit a real
    // cross-origin CORS block (their server has no reason to allow our
    // origin). Deliberately NOT setting a base now: with no <base>, these
    // root-relative URLs resolve against OUR OWN origin instead — which is
    // exactly what we want, now that app/_fr/[...path]/route.js exists at
    // that exact path to proxy them through, same-origin, no CORS at all.
    //
    // SECURITY REVIEW 2026-08-21 — the iframe embedding this needs
    // sandbox="allow-scripts allow-same-origin" for the reasons above
    // (see InvoiceReportButton), which is a known combination that would
    // otherwise let a compromised report script read this origin's
    // localStorage (operator session tokens) and send it anywhere. Can't
    // drop allow-same-origin without breaking the feature (tested live —
    // see that file's comment) or move the tokens out of localStorage in
    // this pass, so mitigated here instead: a CSP that still allows the
    // one thing this document legitimately needs (XHR back to OUR OWN
    // /_fr/* proxy, same origin) but blocks it from ever reaching any
    // THIRD-PARTY domain — the actual exfiltration step. connect-src 'self'
    // is the directive doing the real work; the rest just matches what the
    // fragment already legitimately uses (inline <script>/<style>, icons
    // via the same proxy) so nothing legitimate breaks.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "frame-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ].join('; ');
    const wrapped = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${csp}"></head><body>${result.html}</body></html>`;

    return new Response(wrapped, {
      status:  200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[report/render]', err);
    return Response.json({ error: 'Report rendering failed.' }, { status: 502 });
  }
}
