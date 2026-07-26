// src/app/api/shopify/product-media/[productId]/route.js
//
// Server-side proxy for Shopify product media (images + video).
//
// WHY THIS EXISTS:
//   SHOPIFY_ADMIN_TOKEN is a secret key with full store access — it must
//   never be exposed to the browser. This route runs on the Next.js server,
//   fetches media from Shopify, and returns only the normalized data to the
//   client.
//
// WHY GRAPHQL, NOT THE OLD REST /images.json ROUTE:
//   Shopify's REST Admin API Product resource only exposes `images` — there
//   is no video/3D field on it at all. Video and other rich media only exist
//   on Shopify's newer "Media" object, exposed exclusively via the GraphQL
//   Admin API's `product.media` connection (MediaImage | Video | Model3d |
//   ExternalVideo). Confirmed live 2026-07-26: this store DOES have real
//   video assets uploaded for at least some products (a 360° rotation clip),
//   which the old REST route could never have surfaced.
//
// REQUEST:
//   GET /api/shopify/product-media/{externalProductId}
//
// RESPONSE (success):
//   {
//     images: [{ id, src, alt, width, height, position }],
//     videos: [{ id, alt, position, poster, sources: [{ url, format }] }],
//   }
//
// RESPONSE (error):
//   { images: [], videos: [], error: string }

import { NextResponse } from 'next/server';

const SHOPIFY_STORE = process.env.SHOPIFY_STORE;           // luciraonline.myshopify.com
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;     // shpat_...
const API_VERSION   = '2025-10';

const MEDIA_QUERY = `
  query ProductMedia($id: ID!) {
    product(id: $id) {
      media(first: 50) {
        edges {
          node {
            __typename
            mediaContentType
            alt
            ... on MediaImage {
              image { url altText width height }
            }
            ... on Video {
              sources { url format }
              preview { image { url } }
            }
          }
        }
      }
    }
  }
`;
// NOTE: Video's poster/thumbnail field is `preview { image { url } }`, not
// `previewImage` — the latter doesn't exist on this API version's Video
// type and 400s the whole query (confirmed live 2026-07-26).

export async function GET(request, { params }) {
  const { productId } = await params;

  // ── Guard: missing config ────────────────────────────────────────────────
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) {
    console.error('[Shopify] Missing SHOPIFY_STORE or SHOPIFY_ADMIN_TOKEN env vars');
    return NextResponse.json(
      { images: [], videos: [], error: 'Shopify not configured' },
      { status: 500 }
    );
  }

  // ── Guard: invalid productId ─────────────────────────────────────────────
  if (!productId || !/^\d+$/.test(productId)) {
    return NextResponse.json(
      { images: [], videos: [], error: 'Invalid product ID' },
      { status: 400 }
    );
  }

  // ── Fetch from Shopify GraphQL Admin API ─────────────────────────────────
  const url = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/graphql.json`;

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_TOKEN,
        'Content-Type':           'application/json',
      },
      body: JSON.stringify({
        query:     MEDIA_QUERY,
        variables: { id: `gid://shopify/Product/${productId}` },
      }),
      // Cache for 10 minutes — product media rarely changes mid-day
      next: { revalidate: 600 },
    });

    if (!res.ok) {
      console.error(`[Shopify] media fetch failed: ${res.status} for product ${productId}`);
      return NextResponse.json(
        { images: [], videos: [], error: `Shopify returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const edges = data?.data?.product?.media?.edges ?? [];

    if (data.errors) {
      console.error('[Shopify] media GraphQL errors:', data.errors);
      return NextResponse.json(
        { images: [], videos: [], error: 'Shopify GraphQL error' },
        { status: 502 }
      );
    }

    // Normalise to only what the client needs — never pass raw Shopify data.
    // Position is assigned per-array (not the raw media index) so each list
    // still starts at 1 / is contiguous, matching how the old REST images
    // endpoint's `position` field behaved.
    const images = [];
    const videos = [];

    edges.forEach(({ node }) => {
      if (node.__typename === 'MediaImage' && node.image?.url) {
        images.push({
          id:       node.image.url,
          src:      node.image.url,
          alt:      node.alt ?? node.image.altText ?? null,
          width:    node.image.width  ?? null,
          height:   node.image.height ?? null,
          position: images.length + 1,
        });
      } else if (node.__typename === 'Video') {
        const mp4 = node.sources?.find((s) => s.format === 'mp4') ?? node.sources?.[0] ?? null;
        if (mp4?.url) {
          videos.push({
            id:       mp4.url,
            src:      mp4.url,
            poster:   node.preview?.image?.url ?? null,
            alt:      node.alt ?? null,
            position: videos.length + 1,
          });
        }
      }
      // Model3d / ExternalVideo intentionally not handled — no confirmed
      // use of either media type in this store's catalog yet.
    });

    return NextResponse.json({ images, videos });

  } catch (err) {
    console.error('[Shopify] media fetch error:', err);
    return NextResponse.json(
      { images: [], videos: [], error: 'Failed to fetch media' },
      { status: 500 }
    );
  }
}
