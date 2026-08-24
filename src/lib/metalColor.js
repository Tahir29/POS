// src/lib/metalColor.js
//
// OrnaVerse represents metal color two different ways depending on which
// endpoint an item came from: ProductCatalogRow (catalog list — confirmed
// live 2026-08-23) only carries a short code (metal_color_code: "YG"/"WG"/
// "RG"/"SL"), while Items/Retrieve (product detail) and Style/Retrieve
// (design variants) carry the full human name directly (metal_color_name:
// "Yellow Gold", confirmed against a real Style/Retrieve response the same
// day). Every ProductCard-consuming snapshot — the catalog row itself,
// recentlyViewed's and wishlist's Mongo-stored items — is built from
// whichever of the two the source endpoint actually had, so this resolves
// either shape to the same descriptive name rather than making ProductCard
// (or every snapshot builder) know which source it came from.
//
// Codes seen live on this tenant: YG, WG, RG (gold colors) and SL (silver —
// redundant with metal_id, not a real "color", so deliberately NOT mapped;
// getMetalLabel already says "Silver" and karat_code already carries "925").
const METAL_COLOR_CODE_TO_NAME = {
  YG: 'Yellow Gold',
  WG: 'White Gold',
  RG: 'Rose Gold',
};

/**
 * @param {{ metal_color_code?: string|null, metal_color_name?: string|null }} item
 * @returns {string|null} e.g. "Yellow Gold", or null if neither field resolves to one
 */
export function resolveMetalColorName({ metal_color_code, metal_color_name } = {}) {
  if (metal_color_name && metal_color_name !== 'NA') return metal_color_name;
  if (metal_color_code && metal_color_code !== 'NA') {
    return METAL_COLOR_CODE_TO_NAME[metal_color_code.toUpperCase()] ?? null;
  }
  return null;
}
