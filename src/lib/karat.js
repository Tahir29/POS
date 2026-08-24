// src/lib/karat.js
//
// Extracted 2026-08-23 from useRecentlyViewed.js so the same conversion
// can also feed the product detail page's wishlist snapshot (useWishlist's
// item shape needs the exact same karat_code ProductCard already expects).
//
// ProductCard (catalog card) expects karat_code ("14", "925") — that's what
// ProductCatalogRow (catalog list) carries natively. Items/Retrieve (product
// detail page) has no karat_code field at all, only the human karat_name
// ("14KT", "Silver925") — confirmed live 2026-08-22. Both patterns seen in
// this tenant's real data reduce to "the leading digits", so this covers
// both without needing a lookup table.
export function deriveKaratCode(karatName) {
  if (!karatName) return null;
  const digits = karatName.match(/\d+/);
  return digits ? digits[0] : null;
}
