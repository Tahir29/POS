/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  images: {
    // TEMPORARY (2026-09-18): Vercel's Image Optimization transform quota
    // was hit this billing cycle. Left `true` deliberately even after tuning
    // deviceSizes/imageSizes below and wiring the Shopify-CDN bypass
    // (shopifyImageLoader) — flip back to `false` only once the quota has
    // reset for a new cycle, otherwise this re-trips the same cap
    // immediately. See ProductCard (catalog grid, ~2.7k unique SKUs — the
    // dominant transform-volume source) for why this mattered.
    unoptimized: true,
    // Narrowed from Next's defaults ([640,750,828,1080,1200,1920,2048,3840]
    // / [16,32,48,64,96,128,256,384]) to the widths this app actually
    // renders at — nothing here ever needs a near-4K variant (catalog cards
    // top out around 25vw of a normal desktop viewport, the PDP gallery's
    // widest slot is 50vw, banners are fixed-ish). Fewer breakpoints means
    // fewer distinct transforms billed per unique source image once
    // optimization is back on.
    deviceSizes: [384, 640, 750, 828, 1080, 1200],
    imageSizes: [32, 48, 64, 96, 128, 256],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lucira.live.ornaverse.in',
      },
      {
        protocol: 'https',
        hostname: 'lucira.uat.ornaverse.in',
      },
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
      },
      {
        // Nector-hosted customer review photos (see ProductReviewsList).
        protocol: 'https',
        hostname: 'cdn.nector.io',
      },
    ],
  },

  // ── HTTP SECURITY HEADERS (SEC-008) ──────────────────────────
  // NOTE: CSP is intentionally omitted here.
  // Next.js App Router injects inline scripts at runtime that cannot be
  // covered by a static CSP without a nonce. The correct approach is a
  // middleware-based nonce CSP (future hardening). The remaining headers
  // below provide meaningful protection without breaking the app.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            // camera=(self) — the Barcode Scanner (BarcodeScannerModal) needs
            // getUserMedia camera access. A blanket `camera=()` here overrides
            // any per-site "Allow" the user grants in the browser — the
            // Permissions-Policy header wins over Chrome's own site setting,
            // which is why scanning failed with "Camera permission denied"
            // even when Chrome's camera permission showed Allow. Microphone/
            // geolocation stay locked down — nothing in the app uses them.
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
  // NOTE: '/api/:path*' used to be proxied here via rewrites(). That
  // mechanism returned empty-body 400s from nginx on business-data
  // endpoints even with a valid bearer token — see
  // src/app/api/[...path]/route.js, which replaces it with an explicit
  // server-side fetch we fully control. A filesystem route always wins
  // over a rewrite for the same path, so this config needs nothing here.
};

export default nextConfig;
