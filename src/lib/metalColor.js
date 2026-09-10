// src/lib/metalColor.js
//
// OrnaVerse represents metal color two different ways depending on the
// source endpoint: ProductCatalogRow (catalog list) only carries a short
// code (metal_color_code: "YG"/"WG"/"RG"/"SL"), while Items/Retrieve and
// Style/Retrieve carry the full name directly (metal_color_name: "Yellow
// Gold"). This resolves either shape to the same descriptive name so
// consumers don't need to know which source an item came from.
//
// "SL" (silver) is deliberately NOT mapped — it's redundant with metal_id,
// not a real "color" (getMetalLabel already says "Silver").
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
