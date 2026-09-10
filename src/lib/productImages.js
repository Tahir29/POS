// src/lib/productImages.js
//
// Shared "which photo actually represents THIS colour variant" resolution,
// used by both the product detail gallery and the add-to-cart flow — so a
// cart line always gets the photo of the colour actually selected, not
// Shopify's raw images[0] (which is just the first photo for the whole
// product listing, colour-agnostic).

// Known colour keywords used in Shopify image `alt` text. Anything whose alt
// doesn't match one of these (e.g. "Cert") is treated as colour-agnostic and
// always shown alongside whichever colour is active.
const COLOR_KEYWORDS = ['yellow', 'rose', 'white'];

function altMatchesColor(alt, colorNameLower) {
  if (!alt) return false;
  const altLower = alt.toLowerCase();
  return colorNameLower.includes(altLower) || altLower.includes(colorNameLower);
}

function isColorAgnostic(alt) {
  if (!alt) return true;
  const altLower = alt.toLowerCase();
  return !COLOR_KEYWORDS.some((kw) => altLower.includes(kw));
}

/**
 * @param {{ src, alt, position }[]} shopifyImages
 * @param {string|null} activeColorName — e.g. "Yellow Gold"
 * @returns {{ src, alt, position }[]} the images that match the active
 *   colour (plus any colour-agnostic ones, e.g. a certificate photo) —
 *   falls back to the full unfiltered list if nothing matches (never an
 *   empty gallery over an unrecognised colour name).
 */
export function filterShopifyImagesByColor(shopifyImages, activeColorName) {
  if (!activeColorName || shopifyImages.length === 0) return shopifyImages;

  const colorNameLower = activeColorName.toLowerCase();
  const matched = shopifyImages.filter(
    (img) => altMatchesColor(img.alt, colorNameLower) || isColorAgnostic(img.alt)
  );

  return matched.length > 0 ? matched : shopifyImages;
}

/**
 * The single image that actually represents a specific variant right now —
 * same priority order and colour-filtering ProductImageGallery uses to
 * decide its own first/hero slide, so a cart line (or an analytics event,
 * or anything else that needs "the one photo for this exact variant")
 * never disagrees with what the gallery is showing on screen.
 *
 * @param {object[]} shopifyImages — raw images[] from useShopifyProductImages
 *   (unfiltered — filtering happens in here)
 * @param {string|null} activeColorName — the active item's metal_color_name
 * @param {object|null} item — the active OrnaVerse item/variant, used for the
 *   OrnaVerse-fields fallback (image/image_url/image_1) when Shopify has
 *   nothing, and for the alt-text fallback
 * @param {(raw: string|null) => string|null} resolveOrnaverseSrc — the
 *   caller's own lib/resolveImageSrc — passed in rather than imported here
 *   so this stays a plain data helper, no Next.js image-loader dependency
 * @returns {{ src: string, alt: string } | null}
 */
export function resolveActiveProductImage(shopifyImages, activeColorName, item, resolveOrnaverseSrc) {
  const filtered = filterShopifyImagesByColor(shopifyImages ?? [], activeColorName);
  if (filtered.length > 0) {
    const first = filtered[0];
    return { src: first.src, alt: first.alt ?? item?.item_name ?? 'Product image' };
  }

  const rawSrc = resolveOrnaverseSrc(item?.image ?? item?.image_url ?? item?.image_1 ?? null);
  return rawSrc ? { src: rawSrc, alt: item?.item_name ?? 'Product image' } : null;
}
