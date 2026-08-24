// Fetches Shopify product media (images + video) for a given external_product_id.
//
// ENABLED ONLY when externalProductId is non-null and non-zero.
// On UAT: external_product_id is null → query is disabled → no API call,
//         no error. Falls back to OrnaVerse paths (also null on UAT) →
//         placeholder shown. Zero errors.
// On LIVE: external_product_id has a real Shopify ID → proxy route fires
//          → images (and video, when the product has one) are returned.
//
// MEDIA SHAPE (per shopifyService.js):
//   images: { id, src, alt, width, height, position }[]
//   videos: { id, src, poster, alt, position }[]
//
// Both are sorted by position (Shopify's display order) so the hero image
// stays first and videos stay in the order uploaded.

import { useQuery }                 from '@tanstack/react-query';
import { getShopifyProductMedia }   from '@/services/shopifyService';
import { QUERY_KEYS }               from '@/constants/queryKeys';
import APP_CONFIG                   from '@/constants/appConfig';

// 24h (2026-08-23, was 30 min) — product photos only change when someone
// re-shoots/re-uploads on Shopify, not during a trading day. Paired with
// lib/queryPersister.js, which persists this exact query to IndexedDB so a
// page reload doesn't re-fetch every visible card's image on every visit.
// gcTime must be at least this long too, or the persister has nothing left
// in memory to write out once a card scrolls out of view / unmounts.
const STALE_TIME = APP_CONFIG.STALE_TIME.MASTER_DATA;

/**
 * @param {string|number|null|undefined} externalProductId
 *   Shopify product ID from OrnaVerse Style/Retrieve → Entity.external_product_id
 *
 * @returns {{
 *   images:       Array<{ id, src, alt, width, height, position }>,
 *   videos:       Array<{ id, src, poster, alt, position }>,
 *   primaryImage: { id, src, alt, width, height, position } | null,
 *   isLoading:    boolean,
 *   isError:      boolean,
 *   hasImages:    boolean,
 *   hasVideos:    boolean,
 * }}
 */
export function useShopifyProductImages(externalProductId) {
  const id = externalProductId ?? null;

  const query = useQuery({
    queryKey: QUERY_KEYS.SHOPIFY.PRODUCT_IMAGES(id),
    queryFn:  () => getShopifyProductMedia(id),
    enabled:  !!id,
    staleTime: STALE_TIME,
    gcTime:    STALE_TIME,
    // getShopifyProductMedia never throws — returns { images: [], videos: [] }
    // on any error. So isError will effectively never be true, but we expose
    // it anyway for completeness in case the service layer changes in future.
  });

  const images = (query.data?.images ?? []).slice().sort((a, b) => a.position - b.position);
  const videos = (query.data?.videos ?? []).slice().sort((a, b) => a.position - b.position);

  return {
    images,
    videos,
    primaryImage: images[0] ?? null,
    isLoading:    query.isLoading,
    isError:      query.isError,
    hasImages:    images.length > 0,
    hasVideos:    videos.length > 0,
  };
}
