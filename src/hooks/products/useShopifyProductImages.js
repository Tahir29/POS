// src/hooks/products/useShopifyProductImages.js
//
// Fetches Shopify product images for a given external_product_id.
//
// ENABLED ONLY when externalProductId is non-null and non-zero.
// On UAT: external_product_id is null → query is disabled → no API call,
//         no error. Falls back to OrnaVerse paths (also null on UAT) →
//         placeholder shown. Zero errors.
// On LIVE: external_product_id has a real Shopify ID → proxy route fires
//          → images returned and shown.
//
// IMAGE SHAPE (per shopifyService.js):
//   { id, src, alt, width, height, position }[]
//
// Images are sorted by position (Shopify's display order) so the hero
// image is always first.

import { useQuery }                   from '@tanstack/react-query';
import { getShopifyProductImages }    from '@/services/shopifyService';
import { QUERY_KEYS }                 from '@/constants/queryKeys';

// 30 minutes — product images rarely change during a trading day
const STALE_TIME = 30 * 60 * 1000;

/**
 * @param {string|number|null|undefined} externalProductId
 *   Shopify product ID from OrnaVerse Style/Retrieve → Entity.external_product_id
 *
 * @returns {{
 *   images:     Array<{ id, src, alt, width, height, position }>,
 *   primaryImage: { id, src, alt, width, height, position } | null,
 *   isLoading:  boolean,
 *   isError:    boolean,
 *   hasImages:  boolean,
 * }}
 */
export function useShopifyProductImages(externalProductId) {
  const id = externalProductId ?? null;

  const query = useQuery({
    queryKey: QUERY_KEYS.SHOPIFY.PRODUCT_IMAGES(id),
    queryFn:  () => getShopifyProductImages(id),
    enabled:  !!id,
    staleTime: STALE_TIME,
    // getShopifyProductImages never throws — returns [] on any error.
    // So isError will effectively never be true, but we expose it anyway
    // for completeness in case the service layer changes in future.
  });

  const images = (query.data ?? []).sort((a, b) => a.position - b.position);

  return {
    images,
    primaryImage: images[0] ?? null,
    isLoading:    query.isLoading,
    isError:      query.isError,
    hasImages:    images.length > 0,
  };
}