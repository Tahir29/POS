// src/app/api/shopify/product-images/[productId]/route.js
//
// Server-side proxy for Shopify Admin API product images.
//
// WHY THIS EXISTS:
//   SHOPIFY_ADMIN_TOKEN is a secret key with full store access — it must
//   never be exposed to the browser. This route runs on the Next.js server,
//   fetches images from Shopify, and returns only the image data to the client.
//
// FUTURE-PROOF NOTE:
//   If OrnaVerse starts serving images natively (image fields on Style/Retrieve
//   or ProductCatalog/List become non-null), this route can be left as-is and
//   shopifyService.js updated to use the OrnaVerse paths instead. No client
//   components need to change.
//
// REQUEST:
//   GET /api/shopify/product-images/{externalProductId}
//
// RESPONSE (success):
//   { images: [{ id, src, alt, width, height, position }] }
//
// RESPONSE (error):
//   { images: [], error: string }
//
// Shopify Admin API reference:
//   GET /admin/api/2025-10/products/{product_id}/images.json

import { NextResponse } from 'next/server';

const SHOPIFY_STORE   = process.env.SHOPIFY_STORE;           // luciraonline.myshopify.com
const SHOPIFY_TOKEN   = process.env.SHOPIFY_ADMIN_TOKEN;     // shpat_...
const API_VERSION     = '2025-10';

export async function GET(request, { params }) {
  const { productId } = await params;

  // ── Guard: missing config ────────────────────────────────────────────────
  if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) {
    console.error('[Shopify] Missing SHOPIFY_STORE or SHOPIFY_ADMIN_TOKEN env vars');
    return NextResponse.json(
      { images: [], error: 'Shopify not configured' },
      { status: 500 }
    );
  }

  // ── Guard: invalid productId ─────────────────────────────────────────────
  if (!productId || !/^\d+$/.test(productId)) {
    return NextResponse.json(
      { images: [], error: 'Invalid product ID' },
      { status: 400 }
    );
  }

  // ── Fetch from Shopify Admin API ─────────────────────────────────────────
  const url = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/products/${productId}/images.json`;

  try {
    const res = await fetch(url, {
      method:  'GET',
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_TOKEN,
        'Content-Type':           'application/json',
      },
      // Cache for 10 minutes — product images rarely change mid-day
      next: { revalidate: 600 },
    });

    if (!res.ok) {
      console.error(`[Shopify] images fetch failed: ${res.status} for product ${productId}`);
      return NextResponse.json(
        { images: [], error: `Shopify returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Normalise to only what the client needs — never pass raw Shopify data
    const images = (data.images ?? []).map((img) => ({
      id:       img.id,
      src:      img.src,
      alt:      img.alt ?? null,
      width:    img.width  ?? null,
      height:   img.height ?? null,
      position: img.position ?? 1,
    }));

    return NextResponse.json({ images });

  } catch (err) {
    console.error('[Shopify] images fetch error:', err);
    return NextResponse.json(
      { images: [], error: 'Failed to fetch images' },
      { status: 500 }
    );
  }
}