// Server-side proxy for Shopify product media (images + video) AND the
// product's own description — SHOPIFY_ADMIN_TOKEN is a secret with full
// store access and must never reach the browser; this route fetches from
// Shopify and returns only normalized data to the client.
//
// Uses GraphQL rather than the REST /images.json endpoint because REST's
// Product resource only exposes `images` — video/3D only exist on Shopify's
// newer Media object, available exclusively via the GraphQL Admin API's
// `product.media` connection (MediaImage | Video | Model3d | ExternalVideo).
// This store does have real video assets on some products (a 360° rotation
// clip) that the old REST route could never have surfaced.
//
// `description` (added 2026-09-16) powers ProductStorySection's "Story
// Behind The Product" copy — confirmed live against this store's own real
// products (via the Shopify Admin GraphQL API directly) that `descriptionHtml`
// IS genuinely per-product marketing copy, not boilerplate: two unrelated
// products' descriptions came back completely different, and one of them
// matched a reference screenshot word-for-word. Riding along on this same
// request (not a second round trip) since the PDP already calls this route
// for images/videos on every product view.
//
// REQUEST:
//   GET /api/shopify/product-media/{externalProductId}
//
// RESPONSE (success):
//   {
//     images: [{ id, src, alt, width, height, position }],
//     videos: [{ id, alt, position, poster, sources: [{ url, format }] }],
//     description: string | null,
//   }
//
// RESPONSE (error):
//   { images: [], videos: [], description: null, error: string }

import { NextResponse } from 'next/server';

const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION   = '2025-10';

const MEDIA_QUERY = `
  query ProductMedia($id: ID!) {
    product(id: $id) {
      descriptionHtml
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

// Shopify's descriptionHtml is simple merchant-authored markup (a handful of
// <p>/<br>/<strong> tags in practice, confirmed against this store's real
// products) — not rich enough to warrant a full HTML parser, and rendered
// here as plain text (ProductStorySection uses a bare <p>, no
// dangerouslySetInnerHTML) so there's no markup-injection surface at all.
// Block-level tags become a paragraph break; everything else is stripped.
function htmlToPlainText(html) {
  if (!html) return null;
  const text = html
    .replace(/<\/(p|div|li)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, '\'')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text || null;
}
// NOTE: Video's poster/thumbnail field is `preview { image { url } }`, not
// `previewImage` — the latter doesn't exist on this API version's Video
// type and 400s the whole query.

export async function GET(request, { params }) {
  const { productId } = await params;

  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) {
    console.error('[Shopify] Missing SHOPIFY_STORE or SHOPIFY_ADMIN_TOKEN env vars');
    return NextResponse.json(
      { images: [], videos: [], description: null, error: 'Shopify not configured' },
      { status: 500 }
    );
  }

  if (!productId || !/^\d+$/.test(productId)) {
    return NextResponse.json(
      { images: [], videos: [], description: null, error: 'Invalid product ID' },
      { status: 400 }
    );
  }

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
        { images: [], videos: [], description: null, error: `Shopify returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const product = data?.data?.product;
    const edges = product?.media?.edges ?? [];
    const description = htmlToPlainText(product?.descriptionHtml);

    if (data.errors) {
      console.error('[Shopify] media GraphQL errors:', data.errors);
      return NextResponse.json(
        { images: [], videos: [], description: null, error: 'Shopify GraphQL error' },
        { status: 502 }
      );
    }

    // Position is assigned per-array (not the raw media index) so each list
    // starts at 1 and is contiguous, matching the old REST endpoint's
    // `position` field behavior.
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
      // Model3d / ExternalVideo intentionally not handled — unused so far.
    });

    return NextResponse.json({ images, videos, description });

  } catch (err) {
    console.error('[Shopify] media fetch error:', err);
    return NextResponse.json(
      { images: [], videos: [], description: null, error: 'Failed to fetch media' },
      { status: 500 }
    );
  }
}
