// src/lib/analytics/productAttributes.js
//
// Single source of truth for "everything we know about a product" as
// analytics attributes. Before this, every product-related tracker.track()
// call site (AddToCartButton, the product detail page's view_item, ...)
// independently re-read a different SUBSET of fields straight off raw
// product/pricing objects — confirmed by audit 2026-09-08: the product
// page's view_item event sent ~30 fields, AddToCartButton's add_to_cart
// sent about a dozen DIFFERENT ones (no gemstone, no price breakup), and
// neither agreed on field names. Enriching one call site never touched the
// others. Call buildProductAttributes() once per event site instead of
// hand-picking fields again — one place to add a field everyone gets it.
//
// SOURCES, most-specific first — pass whichever you have; anything ahead
// in this list, when present, wins for the fields it can answer:
//   pricedItem — a live-priced SetSalesItems row (real sub_total/net_amount/
//     per-component money amounts, the only source with a genuine per-piece
//     sku). Wins for anything money- or weight-component-shaped.
//   activeItem — the specific variant/customization currently selected
//     (from useDesignVariants/CustomizeSheet), when the shopper has
//     customized away from the base product.
//   product    — the item master (Items/Retrieve or ProductCatalogRow) —
//     the fallback for everything else (identity, classification, hsn).
//
// GEMSTONE DETAIL comes from item_components/components (the BOM array),
// NOT a flat field on any of the three sources above — filtered to
// item_group_id === 113 / item_group_name === 'Color Stone' (the same
// filter ProductSpecifications.jsx already uses for its own Gemstone
// card) and flattened into gemstone_type/shape/color/size below, parsed
// from the row's composite `attribute` string
// ("{Shape}/{Color}/{Metal}/{Size}/{Quality}", e.g. "PR/RED/NA/4.5*4.5/NA")
// when the row's own resolved shape_name/stone_color_name are missing —
// confirmed live: a SetSalesItems-priced component row often only carries
// the composite string, not resolved names.
//
// EVERY field defaults to null, never omitted. A consistent, predictable
// schema is the whole point — a caller checking event.diamond_weight for
// "was there a diamond" can rely on it being null (not undefined, not
// simply absent) when there wasn't one, on every event, not just the ones
// someone happened to remember to add it to.
//
// PII-SAFE. Nothing here is customer data — every field is either
// GA4-safe already or becomes so once wrapped in the caller's own
// properties/webengageExtra split (see tracker.js's own jsdoc); this
// module has no opinion on which destination gets which field, that
// split still belongs to each call site.

import { resolveMetalColorName } from '@/lib/metalColor';

const GEMSTONE_GROUP_ID = 113;
const GEMSTONE_GROUP_NAME = 'Color Stone';

function firstGemstoneComponent(components) {
  if (!Array.isArray(components)) return null;
  return components.find(
    (c) => c.item_group_id === GEMSTONE_GROUP_ID || c.item_group_name === GEMSTONE_GROUP_NAME
  ) ?? null;
}

// Parses "{Shape}/{Color}/{Metal}/{Size}/{Quality}" — see this file's own
// header for why this exists. "NA" segments (confirmed live — OrnaVerse's
// own placeholder for "not applicable") resolve to null, same as every
// other "NA" field this app already treats that way (see e.g. the
// product page's own `na()` helper).
function parseGemstoneAttribute(attribute) {
  if (!attribute || typeof attribute !== 'string') return {};
  const [shape, color, , size] = attribute.split('/');
  const na = (v) => (v && v !== 'NA' ? v : null);
  return { shape: na(shape), color: na(color), size: na(size) };
}

/**
 * @param {{
 *   product?:    object|null, — item master (Items/Retrieve or ProductCatalogRow)
 *   activeItem?: object|null, — the currently-selected variant/customization, if any
 *   pricedItem?: object|null, — live-priced SetSalesItems row (useVariantPricing's
 *                               data) — real sub_total/net_amount/per-component
 *                               amounts + the genuine per-piece sku
 *   image?:            string|null, — resolved primary image URL; caller has
 *                                     already resolved any colour/customization-
 *                                     specific image (see AddToCartButton's own
 *                                     "MUST already be colour-matched" note)
 *   productUrl?:       string|null,
 *   selectedSizeId?:   number|null,
 *   selectedSizeName?: string|null,
 *   hasStock?:         boolean|null,
 * }} sources
 * @returns {object} flat attributes object — numbers/strings/booleans/null
 *   only, safe for both GA4's `properties` and WebEngage's `webengageExtra`.
 */
export function buildProductAttributes({
  product = null, activeItem = null, pricedItem = null,
  image = null, productUrl = null, selectedSizeId = null, selectedSizeName = null,
  hasStock = null,
} = {}) {
  const item   = activeItem ?? product ?? {};
  const priced = pricedItem ?? {};

  const components = item.item_components ?? item.components ?? priced.item_components ?? null;
  const gemstone = firstGemstoneComponent(components);
  const parsed   = parseGemstoneAttribute(gemstone?.attribute);

  return {
    // Identity / media
    item_id:     item.item_id ?? null,
    item_code:   item.item_code ?? null,
    item_name:   item.item_name ?? null,
    sku:         priced.sku ?? null, // per-piece SKU only ever lives on the priced row — see this file's header
    style_id:    item.style_id ?? null,
    image:       image ?? item.image_url ?? item.image ?? null,
    product_url: productUrl,
    has_stock:   hasStock,

    // Classification
    item_group_name: item.item_group_name ?? null,
    category:        item.type_name ?? null,
    sub_category:    item.sub_type_name ?? null,
    collection:      item.collection_name ?? null,
    brand:           item.brand_name ?? null,
    hsn:             item.hsn ?? null,

    // Metal
    metal:       item.metal_name ?? null,
    karat:       item.karat_name ?? null,
    // FIXED 2026-09-09 — was `item.metal_color_name ?? null`. ProductCatalogRow
    // (a catalog-listed `product`) only ever carries the short code
    // (metal_color_code: "YG"/"WG"/"RG"), not the full name — see
    // resolveMetalColorName's own header (ProductCard already uses it for
    // exactly this reason). The add-to-cart path today always passes a full
    // Items/Retrieve `product` (which does carry metal_color_name), so this
    // rarely bit in practice — but it's the same field this app already
    // treats as unreliable everywhere else, so resolving it the same
    // defensive way here too rather than assuming today's one caller always
    // will.
    metal_color: resolveMetalColorName(item) ?? null,

    // Size
    size_id:   selectedSizeId   ?? item.item_size_id   ?? null,
    size_name: selectedSizeName ?? item.item_size_name ?? null,

    // Weight — gross (everything: metal + diamonds + gemstones + all
    // components, per ProductSpecifications.jsx's own static copy) vs net
    // (metal only) vs per-component.
    gross_weight: item.weight     ?? null,
    net_weight:   item.net_weight ?? null,
    stone_weight:       priced.stone_weight       ?? item.stone_weight       ?? null,
    diamond_weight:     priced.diamond_weight      ?? item.diamond_weight     ?? null,
    color_stone_weight: priced.color_stone_weight  ?? item.color_stone_weight ?? null,
    other_weight:       priced.other_weight        ?? item.other_weight       ?? null,
    diamond_pieces:     priced.diamond_pieces      ?? item.diamond_pieces     ?? null,
    stone_pieces:       priced.stone_pieces        ?? item.stone_pieces       ?? null,
    color_stone_pieces: priced.color_stone_pieces  ?? item.color_stone_pieces ?? null,
    other_pieces:       priced.other_pieces        ?? item.other_pieces       ?? null,

    // Dimensions — physical size beyond weight (rings/pendants/bangles)
    height: item.height ?? null,
    width:  item.width  ?? null,
    length: item.length ?? null,
    depth:  item.depth  ?? null,

    // Gemstone detail — the one Color Stone BOM component, when present.
    // See this file's header for why there's no flat field for this.
    gemstone_type:  gemstone?.type_name        ?? null,
    gemstone_shape: gemstone?.shape_name       ?? parsed.shape ?? null,
    gemstone_color: gemstone?.stone_color_name ?? parsed.color ?? null,
    gemstone_size:  parsed.size ?? null,

    // Price breakup — LIVE-priced entity only. The item master's own price
    // fields (item_rate/sale_price/price/mrp/rate/compare_price) are never
    // used as a fallback — see pricingService.js/catalogService.js's own
    // headers for why those are stale and can understate a piece by 2-3x.
    price_metal_amount:       priced.metal_amount       ?? null,
    price_diamond_amount:     priced.diamond_amount      ?? null,
    price_stone_amount:       priced.stone_amount        ?? null,
    price_color_stone_amount: priced.color_stone_amount  ?? null,
    price_other_amount:       priced.other_amount        ?? null,
    price_making_charges:     priced.item_labour          ?? null,
    price_sub_total:          priced.sub_total            ?? null,
    price_taxable_amount:     priced.taxable_amount        ?? null,
    price_tax_amount:         priced.tax_amount            ?? null,
    price_net_amount:         priced.net_amount            ?? null,
  };
}
