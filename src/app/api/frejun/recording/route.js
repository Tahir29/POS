// src/app/api/frejun/recording/route.js
// SERVER-ONLY audio streaming proxy.
// Frejun's recordings are stored in AWS S3 and accessed via redirects from api.frejun.com.
// Because S3 does not send CORS headers and cross-domain redirects cause issues in browser <audio> tags,
// this route proxies and buffers/streams the audio with Range header support for seamless playback and seeking.

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return new Response('Missing audio url parameter', { status: 400 });
  }

  try {
    const parsed = new URL(targetUrl);
    // Security check: only allow frejun or amazonaws hosts
    const isAllowedHost =
      parsed.hostname.endsWith('frejun.com') ||
      parsed.hostname.endsWith('amazonaws.com') ||
      parsed.hostname.includes('s3');

    if (!isAllowedHost) {
      return new Response('Forbidden target host', { status: 403 });
    }

    const headers = {};
    const clientRange = request.headers.get('range');
    if (clientRange) {
      headers.range = clientRange;
    }

    // cache: 'no-store' is mandatory in Next.js App Router to prevent Next.js Data Cache
    // from attempting to cache binary audio streams, which throws a 500 error.
    const upstreamRes = await fetch(targetUrl, {
      method: 'GET',
      headers,
      redirect: 'follow',
      cache: 'no-store',
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      console.warn('[recording/route] Upstream returned non-ok status:', upstreamRes.status, upstreamRes.statusText);
      // Fallback: redirect directly to the target URL
      return Response.redirect(targetUrl, 302);
    }

    const buffer = await upstreamRes.arrayBuffer();

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', upstreamRes.headers.get('content-type') || 'audio/wav');
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');

    if (upstreamRes.headers.get('content-length')) {
      responseHeaders.set('Content-Length', String(buffer.byteLength));
    }
    if (upstreamRes.headers.get('content-range')) {
      responseHeaders.set('Content-Range', upstreamRes.headers.get('content-range'));
    }

    return new Response(buffer, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error('[API /api/frejun/recording] Proxy error:', err);
    // Graceful fallback: redirect the browser directly to the target URL
    try {
      return Response.redirect(targetUrl, 302);
    } catch {
      return new Response('Failed to stream audio recording', { status: 500 });
    }
  }
}
