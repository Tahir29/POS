/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  images: {
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
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
 async rewrites() {
    return [
      // {
      //   source: '/ornaverse-api/:path*',
      //   destination: 'https://lucira.uat.ornaverse.in/:path*',
      // },
      {
        source: '/api/:path*',
        destination: 'https://lucira.uat.ornaverse.in/:path*',
      },
    ]
  }
};

export default nextConfig;
