// Server-side reverse proxy for every OrnaVerse API call. Forwards each
// method straight through; a filesystem route always wins over a
// next.config.mjs rewrite for the same path. ACTIVE_ENV/UPSTREAM/
// CLIENT_SECRET resolve from lib/ornaverse/upstream.js — switch
// environments there, not here.
//
// connect/token needs HTTP Basic Auth (client_id:client_secret) on LIVE's
// confidential client; UAT's client is public and has no secret. Client
// secret is server-only, injected below, never sent to the browser.
import { UPSTREAM, CLIENT_SECRET } from '@/lib/ornaverse/upstream';
import { checkRateLimit, getClientIp } from '@/lib/security/rateLimit';
import { getCachedRead, setCachedRead, isCacheableReadPath } from '@/lib/security/proxyReadCache';

async function proxy(request, { params }) {
  const { path } = await params;
  const resolvedPath = path.join('/');
  const targetUrl = `${UPSTREAM}/${resolvedPath}${request.nextUrl.search}`;
  const isTokenEndpoint = resolvedPath === 'connect/token';

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  const authorization = request.headers.get('authorization');
  if (authorization) headers.set('Authorization', authorization);

  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const body = hasBody ? await request.text() : undefined;

  // SEC-004: throttle password-grant login attempts before the client
  // secret is ever attached (this is the one unauthenticated,
  // credential-guessing call this proxy forwards). Not applied to
  // refresh_token, which fires on its own timer and isn't a guess.
  const tokenParams = isTokenEndpoint && body ? new URLSearchParams(body) : null;

  if (tokenParams && tokenParams.get('grant_type') === 'password') {
    const ip = getClientIp(request);
    const username = (tokenParams.get('username') ?? '').trim().toLowerCase();

    const perAccount = checkRateLimit(`login:${ip}:${username}`, { limit: 5, windowMs: 5 * 60 * 1000 });
    const perIp = checkRateLimit(`login-ip:${ip}`, { limit: 20, windowMs: 5 * 60 * 1000 });

    if (!perAccount.allowed || !perIp.allowed) {
      const retryAfterSeconds = Math.max(perAccount.retryAfterSeconds, perIp.retryAfterSeconds);
      return new Response(
        JSON.stringify({
          error: 'too_many_attempts',
          error_description: 'Too many login attempts. Please try again later.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfterSeconds),
          },
        },
      );
    }
  }

  if (tokenParams && CLIENT_SECRET && !headers.has('Authorization')) {
    const clientId = tokenParams.get('client_id');
    if (clientId) {
      const basic = Buffer.from(`${clientId}:${CLIENT_SECRET}`).toString('base64');
      headers.set('Authorization', `Basic ${basic}`);
    }
  }

  // Short-TTL cache for a small allowlist of read-only, tenant-wide
  // reference endpoints (payment modes, sales persons, document numbering,
  // today's metal rate) — see lib/security/proxyReadCache.js. Keyed on
  // path+body, not just path, since these are POST reads that vary by
  // company_id in the body.
  const cacheKey = isCacheableReadPath(resolvedPath) ? `${resolvedPath}::${body ?? ''}` : null;
  if (cacheKey) {
    const cached = getCachedRead(cacheKey);
    if (cached) {
      return new Response(cached.bytes, {
        status: cached.status,
        headers: { 'Content-Type': cached.contentType },
      });
    }
  }

  let upstreamRes;
  try {
    upstreamRes = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
    });
  } catch (err) {
    console.error('[api proxy] upstream fetch failed', targetUrl, err);
    return new Response(
      JSON.stringify({
        error: 'upstream_unreachable',
        error_description: 'Could not reach the OrnaVerse server. Please check your connection and try again.',
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const responseContentType = upstreamRes.headers.get('content-type') ?? 'application/json';

  if (cacheKey && upstreamRes.ok) {
    const bytes = await upstreamRes.arrayBuffer();
    setCachedRead(cacheKey, { bytes, status: upstreamRes.status, contentType: responseContentType });
    return new Response(bytes, { status: upstreamRes.status, headers: { 'Content-Type': responseContentType } });
  }

  // Streamed straight through (not buffered) for everything else, so a
  // large response doesn't hold this invocation's memory/CPU active for
  // the whole download.
  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: { 'Content-Type': responseContentType },
  });
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as DELETE,
  proxy as PATCH,
};
