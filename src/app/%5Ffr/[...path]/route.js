// src/app/%5Ffr/[...path]/route.js — resolves to the URL path /_fr/[...path]
//
// Can't be named `_fr` on disk: Next.js treats any App Router folder
// starting with `_` as a private folder, excluded from routing entirely.
// `%5F` is Next.js's documented escape for a literal underscore in the
// folder name, giving a route that matches `/_fr/...` without tripping
// that convention.
//
// Generic proxy for OrnaVerse's FastReport web viewer's own follow-up calls:
// the HTML /Print/Render returns is a shell whose embedded <script> calls
// back to root-relative URLs like `_fr/preview.getReport?reportId=...` and
// `_fr/resources.getResource?...`. That script runs inside our iframe at
// our origin, so those root-relative calls resolve here rather than against
// OrnaVerse directly — otherwise they'd be a cross-origin request OrnaVerse
// has no reason to allow via CORS. Mounted at this exact path (not under
// /api) so those requests land here unmodified and same-origin; the real
// cross-origin call is then made server-side with the operator's
// report-session cookie attached, as /api/report/render/route.js does for
// the initial render.
//
// Deliberately generic (any method, any sub-path, any content-type,
// binary-safe) rather than enumerating known calls — the viewer can need
// resources (fonts/icons), pagination, or export endpoints not seen yet,
// and all of them share this same shape.

import { UPSTREAM } from '@/lib/ornaverse/upstream';
import { getReportSession, REPORT_SESSION_COOKIE } from '@/lib/ornaverse/reportSession';

async function proxy(request, { params }) {
  const { path } = await params;
  const sessionId = request.cookies?.get?.(REPORT_SESSION_COOKIE)?.value;
  const session = getReportSession(sessionId);

  // No session to attach — same as the render route, can't silently
  // re-login. This is an invisible, embedded call, so the viewer's own JS
  // just surfaces whatever error handling it has; acceptable since the
  // render route already told the operator up front to sign in again.
  if (!session) {
    return new Response('Report session unavailable.', { status: 401 });
  }

  // Path traversal guard: Next.js decodes each catch-all segment
  // independently, so a single encoded segment can decode to `../Services/
  // POS/Invoice/Create` and, if naively concatenated into a URL, let the
  // WHATWG URL parser collapse the `..` and escape the `/_fr/` prefix
  // entirely — reaching any path on UPSTREAM with the operator's real
  // OrnaVerse cookie attached. Guarded two ways: reject a literal `.`/`..`
  // segment up front, then canonicalize via URL resolution and verify the
  // result never left the `/_fr/` prefix (catches odd encodings the first
  // check misses).
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

  // Binary-safe both ways — these calls can carry/return fonts, icons, or
  // exported files, not just text, mirroring api/[...path]/route.js.
  const hasBody = !['GET', 'HEAD'].includes(request.method);
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
