// Shopify's own CDN already resizes images via a `width` query param, so
// re-transforming a Shopify-hosted photo through Vercel's Image
// Optimization API is redundant spend. Pass shopifyImageLoader as
// next/image's `loader` prop, conditionally, only when the src is actually
// Shopify-hosted — other sources through the same <Image> still use
// Vercel's default optimizer.

const SHOPIFY_HOSTNAME = 'cdn.shopify.com';

/** @param {string|null|undefined} src */
export function isShopifyImageUrl(src) {
  if (!src || typeof src !== 'string') return false;
  try {
    return new URL(src).hostname === SHOPIFY_HOSTNAME;
  } catch {
    return false;
  }
}

/** @param {{ src: string, width: number, quality?: number }} params */
export function shopifyImageLoader({ src, width, quality }) {
  const url = new URL(src);
  url.searchParams.set('width', String(width));
  if (quality) url.searchParams.set('quality', String(quality));
  return url.href;
}
