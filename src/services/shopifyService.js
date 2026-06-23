// src/services/shopifyService.js
//
// Client-side service for Shopify data used in Lucira POS.
//
// ─── FUTURE-PROOF SWAP POINT ───────────────────────────────────────────────
// Currently: images are fetched from Shopify Admin API via our proxy route.
// Future:    if OrnaVerse starts returning image URLs natively (image fields
//            on Style/Retrieve or ProductCatalog/List become non-null), update
//            ONLY this file. No hooks, components, or pages need to change.
//
//   TODAY  → getShopifyProductImages(externalProductId)
//              calls /api/shopify/product-images/{id}  (our proxy → Shopify)
//
//   FUTURE → replace fetch() body to read OrnaVerse image fields directly
// ───────────────────────────────────────────────────────────────────────────
//
// IMAGE SHAPE returned by getShopifyProductImages:
//   { id, src, alt, width, height, position }[]

/**
 * Fetches product images from Shopify via our server-side proxy route.
 * The proxy hides SHOPIFY_ADMIN_TOKEN from the browser.
 *
 * Returns an empty array (never throws) so callers can always safely
 * destructure without a try/catch.
 *
 * @param {string|number} externalProductId - Shopify product ID from
 *   OrnaVerse Style/Retrieve → Entity.external_product_id
 *
 * @returns {Promise<Array<{
 *   id:       number,
 *   src:      string,
 *   alt:      string|null,
 *   width:    number|null,
 *   height:   number|null,
 *   position: number,
 * }>>}
 */
export async function getShopifyProductImages(externalProductId) {
  if (!externalProductId) return [];

  try {
    const res = await fetch(
      `/api/shopify/product-images/${externalProductId}`,
      {
        method:  'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!res.ok) {
      console.warn(
        `[shopifyService] product-images returned ${res.status} for product ${externalProductId}`
      );
      return [];
    }

    const data = await res.json();
    return Array.isArray(data.images) ? data.images : [];

  } catch (err) {
    console.warn('[shopifyService] getShopifyProductImages failed:', err);
    return [];
  }
}