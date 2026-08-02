// src/services/checkoutPricingService.js
// Rebuilds Order/Invoice Create line_items[] from the FULL computed
// Helpers/SetSalesItems object — confirmed live 2026-07-28 (by capturing a
// real successful Order/Create request from OrnaVerse's own frontend) that
// the server expects each line item as that ~70-field computed shape
// (item_components[] BOM, item_operations[] making charges, item_taxes[]
// CGST/SGST breakdown, hsn, tax_template_id, karat/metal fields...) — NOT
// the flattened ~10-field summary cartSlice.js stores (itemId, unitPrice,
// quantity...). That summary only ever existed for cart display; it never
// carried enough to satisfy Create.
//
// Re-prices at SUBMISSION time rather than trusting whatever was computed
// when the item was added to cart — correct as well as necessary, since
// metal rates can move intraday and a cart sitting open for a while
// shouldn't check out at a stale rate.

import { getItemDetail, getDesignVariants } from '@/services/itemService';
import { calculateItemRates } from '@/services/pricingService';

// Fields on the SetSalesItems response that represent a TOTAL for the
// pieces on that line (weights, monetary amounts, piece counts) — these
// scale with cart quantity. Everything else (unit rates, percentages,
// ids, karat/metal/shape codes) is quantity-independent and left as-is.
const SCALE_FIELDS = [
  'pieces', 'weight', 'net_weight', 'pure_weight', 'parts',
  'diamond_pieces', 'diamond_weight', 'stone_pieces', 'stone_weight',
  'other_pieces', 'other_weight', 'color_stone_pieces', 'color_stone_weight',
  'metal_amount', 'diamond_amount', 'color_stone_amount', 'stone_amount',
  'other_amount', 'item_rate', 'item_labour', 'sub_total', 'net_amount',
  'base_sub_total', 'base_net_amount', 'taxable_amount', 'tax_amount',
  'base_tax_amount', 'mf_amount', 'wastage_weight', 'certification_charges',
  'other_charges', 'export_pieces', 'amount', 'base_amount',
];

function scaleByQuantity(obj, quantity) {
  if (quantity === 1) return obj;
  const scaled = { ...obj };
  for (const field of SCALE_FIELDS) {
    if (typeof scaled[field] === 'number') {
      scaled[field] = +(scaled[field] * quantity).toFixed(2);
    }
  }
  for (const arrKey of ['item_components', 'item_operations', 'item_taxes']) {
    if (Array.isArray(scaled[arrKey])) {
      scaled[arrKey] = scaled[arrKey].map((row) => scaleByQuantity(row, quantity));
    }
  }
  return scaled;
}

/**
 * Resolves the full master item object SetSalesItems needs as input — a
 * style_variants[] entry (Style/Retrieve, when the item has a style) or the
 * plain Items/Retrieve Entity otherwise. Both shapes carry the full
 * item_components[] BOM SetSalesItems recomputes rates against.
 */
async function resolveFullItem({ itemId, styleId }) {
  if (styleId) {
    const response = await getDesignVariants(styleId);
    const variants = response?.data?.Entity?.style_variants ?? [];
    const variant = variants.find((v) => v.item_id === itemId);
    if (variant) return variant;
    // Fall through to Items/Retrieve rather than failing checkout outright
    // for an item whose style lookup didn't happen to include it.
  }
  const response = await getItemDetail(itemId);
  return response?.data?.Entity ?? null;
}

/**
 * Builds Order/Invoice Create line_items[] from live cart items.
 *
 * @param {{
 *   items: {itemId, itemName, styleId, sizeId, quantity}[],
 *   activeStoreId: number,
 *   salesPersonId: number,
 * }} params
 * @returns {Promise<object[]>} line_items ready to attach to the Entity
 */
export async function buildPricedLineItems({ items, activeStoreId, salesPersonId }) {
  const fullItems = await Promise.all(
    items.map((item) => resolveFullItem({ itemId: item.itemId, styleId: item.styleId }))
  );

  const missingIndex = fullItems.findIndex((f) => !f);
  if (missingIndex !== -1) {
    throw new Error(`Could not resolve live pricing data for "${items[missingIndex].itemName}"`);
  }

  // Stateless calculation — response order matches request order (same
  // assumption already relied on by useVariantPricing's single-item call).
  const priced = await calculateItemRates(fullItems);

  return items.map((item, idx) => {
    const pricedItem = priced[idx];
    if (!pricedItem) {
      throw new Error(`Live pricing failed for "${item.itemName}"`);
    }
    const scaled = scaleByQuantity(pricedItem, item.quantity);
    return {
      ...scaled,
      item_line_no:    idx + 1,
      item_size_id:    item.sizeId ?? undefined,
      company_id:      activeStoreId,
      sales_person_id: salesPersonId,
      // SetSalesItems does NOT return item_cost, but Invoice/Create rejects a
      // line without it — "<item> Item cost must be a valid non-negative
      // amount" (live 400, 2026-08-01). OrnaVerse's own client fills it in the
      // same way after its Set*Items call: `y.item_cost = 0`.
      //
      // Zero rather than item_rate on purpose: item_cost is the PURCHASE cost,
      // not the sale rate, and nothing in the pricing response tells us what it
      // is. Copying the sale rate into it would silently report every sale at
      // zero margin.
      item_cost:       0,
    };
  });
}

/**
 * Sums the authoritative per-line totals (computed by SetSalesItems, not
 * the cart's display-only flat-3%-GST estimate) into header-level figures —
 * including the aggregate pieces/weight/net_weight the header itself
 * carries (confirmed live 2026-07-28: omitting these was part of what
 * still 500'd even after every other header field was correct).
 * @param {object[]} lineItems — output of buildPricedLineItems
 */
export function summarizeLineItems(lineItems) {
  const sum = (field) => +lineItems.reduce((s, li) => s + (li[field] ?? 0), 0).toFixed(2);
  return {
    subTotal:      sum('sub_total'),
    taxableAmount: sum('taxable_amount'),
    taxAmount:     sum('tax_amount'),
    netAmount:     sum('net_amount'),
    pieces:        sum('pieces'),
    weight:        sum('weight'),
    netWeight:     sum('net_weight'),
  };
}
