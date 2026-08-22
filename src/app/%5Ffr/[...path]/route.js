// src/app/%5Ffr/[...path]/route.js — resolves to the URL path /_fr/[...path]
//
// FOLDER NAME NOTE: this can't be named `_fr` on disk. Next.js treats any
// App Router folder starting with `_` as a "private folder" — excluded
// from routing entirely, silently, with no error. That's exactly what
// happened here first: the route matched nothing, every call 404'd before
// ever reaching this file's code (confirmed by a temp diagnostic log line
// that never printed). `%5F` is Next.js's own documented escape — the
// URL-encoded underscore in the FOLDER name gives a route that matches the
// literal `/_fr/...` URL without tripping the private-folder convention.
//
// Generic proxy for OrnaVerse's FastReport WEB VIEWER's own follow-up calls
// — confirmed live 2026-08-21: the HTML /Print/Render returns is NOT
// self-contained. It's a shell whose own embedded <script> immediately
// calls back to endpoints like `_fr/preview.getReport?reportId=...` (to
// fetch the actual report body) and `_fr/resources.getResource?...` (icons,
// fonts) using ROOT-RELATIVE URLs.
//
// That's the same problem /Print/Render itself had (cookie-authenticated,
// ignores our bearer token — see reportSession.js), one layer deeper: the
// viewer's own JS runs INSIDE our iframe, at OUR origin (the iframe is
// sandboxed with allow-same-origin, and a srcDoc frame with no <base>
// resolves root-relative URLs against its embedder — us). A root-relative
// XHR from our origin straight to OrnaVerse's real host is a genuine
// cross-origin request, and their server has no reason to grant our origin
// CORS access to it — confirmed live: "Access to XMLHttpRequest at
// '.../_fr/preview.getReport?...' from origin 'http://localhost:3000' has
// been blocked by CORS."
//
// Mounted at this EXACT path (not under /api) so the viewer's own
// root-relative `/_fr/...` requests land here with zero rewriting of its
// HTML/JS — same-origin from the browser's point of view, so no CORS
// involved at all. We then make the real cross-origin call ourselves,
// server-side, with the operator's report-session cookie attached, exactly
// as /api/report/render/route.js already does for the initial render.
//
// Deliberately generic (any method, any sub-path, any content-type,
// binary-safe) rather than enumerating known calls — the viewer can need
// resources (fonts/icons), pagination, or export endpoints we haven't
// specifically seen yet, and all of them share this same shape.

import { UPSTREAM } from '@/lib/ornaverse/upstream';
import { getReportSession, REPORT_SESSION_COOKIE } from '@/lib/ornaverse/reportSession';

async function proxy(request, { params }) {
  const { path } = await params;
  const sessionId = request.cookies?.get?.(REPORT_SESSION_COOKIE)?.value;
  const session = getReportSession(sessionId);

  // No session to attach — same "can't silently re-login" constraint as
  // the render route. This is an invisible, embedded call the operator
  // never sees directly, so the viewer's own JS surfaces whatever error
  // handling it has (as seen live: a plain "Error 0 -" in the preview) —
  // acceptable here, since the render route already told them up front to
  // sign in again if their session was missing.
  if (!session) {
    return new Response('Report session unavailable.', { status: 401 });
  }

  // SECURITY FIX 2026-08-21 — path traversal, confirmed via security review:
  // Next.js decodes each catch-all segment independently, so a request like
  // `/_fr/%2e%2e%2fServices%2fPOS%2fInvoice%2fCreate` arrives as a SINGLE
  // segment that decodes to the literal string `../Services/POS/Invoice/
  // Create`. Naively string-concatenating that into a URL and handing it to
  // fetch() let the WHATWG URL parser collapse the `..` and escape `/_fr/`
  // entirely, reaching ANY path on UPSTREAM — with the operator's real
  // OrnaVerse cookie session attached. Fixed two ways: reject any segment
  // that's literally `.`/`..` up front (cheap, explicit), then canonicalize
  // via URL resolution and verify the RESULT never left the `/_fr/` prefix
  // (the real guard — catches anything the first check doesn't, e.g. odd
  // encodings that still decode to a traversal after Next.js's own pass).
  if (path.some((segment) => segment === '.' || segment === '..')) {
    return new Response('Invalid path.', { status: 400 });
  }

  const targetUrl = new URL(path.join('/'), `${UPSTREAM}/_fr/`);
  if (
    targetUrl.origin !== new URL(UPSTREAM).origin ||
    !targetUrl.pathname.startsWith('/_fr/')
  ) {
    return new Response('Invalid path.', { status: 400 });
  }
  targetUrl.search = request.nextUrl.search;

  const headers = { Cookie: session.cookie };
  const contentType = request.headers.get('content-type');
  if (contentType) headers['Content-Type'] = contentType;
  if (session.csrf) headers['X-CSRF-TOKEN'] = session.csrf;

  const hasBody = !['GET', 'HEAD'].includes(request.method);
  // Binary-safe both ways — these calls can carry/return fonts, icons, or
  // exported files, not just text, mirroring api/[...path]/route.js.
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const upstreamRes = await fetch(targetUrl, {
    method:   request.method,
    headers,
    body,
    cache:    'no-store',
    redirect: 'manual',
  });

  const responseBody = await upstreamRes.arrayBuffer();
  return new Response(responseBody, {
    status:  upstreamRes.status,
    headers: {
      'Content-Type': upstreamRes.headers.get('content-type') ?? 'application/octet-stream',
    },
  });
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as DELETE,
  proxy as PATCH,
};
