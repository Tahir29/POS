// Client-side service for Shopify data used in Lucira POS.
//
// Media (images + video) is fetched from Shopify's GraphQL Admin API via our
// proxy route. If OrnaVerse ever starts returning image URLs natively, only
// this file needs to change — no hooks, components, or pages depend on the
// source.
//
// MEDIA SHAPE returned by getShopifyProductMedia:
//   {
//     images: { id, src, alt, width, height, position }[],
//     videos: { id, src, poster, alt, position }[],
//   }

/**
 * Fetches product media (images + video) from Shopify via our server-side
 * proxy route. The proxy hides SHOPIFY_ADMIN_TOKEN from the browser.
 *
 * Never throws — returns empty arrays on any error so callers can always
 * safely destructure without a try/catch.
 *
 * @param {string|number} externalProductId - Shopify product ID from
 *   OrnaVerse Style/Retrieve → Entity.external_product_id
 *
 * @returns {Promise<{
 *   images: Array<{ id: number|string, src: string, alt: string|null, width: number|null, height: number|null, position: number }>,
 *   videos: Array<{ id: string, src: string, poster: string|null, alt: string|null, position: number }>,
 * }>}
 */
export async function getShopifyProductMedia(externalProductId) {
  if (!externalProductId) return { images: [], videos: [] };

  try {
    const res = await fetch(
      `/api/shopify/product-media/${externalProductId}`,
      {
        method:  'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!res.ok) {
      console.warn(
        `[shopifyService] product-media returned ${res.status} for product ${externalProductId}`
      );
      return { images: [], videos: [] };
    }

    const data = await res.json();
    return {
      images: Array.isArray(data.images) ? data.images : [],
      videos: Array.isArray(data.videos) ? data.videos : [],
    };

  } catch (err) {
    console.warn('[shopifyService] getShopifyProductMedia failed:', err);
    return { images: [], videos: [] };
  }
}
