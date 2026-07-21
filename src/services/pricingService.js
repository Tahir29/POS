// src/services/pricingService.js
// Live per-item price calculation via Services/Helpers/SetSalesItems.
//
// This is the endpoint OrnaVerse's own UI calls to price a variant — NOT
// Services/Helpers/GetRate (confirmed live 2026-07-22: GetRate never fires
// when a variant is selected there). See apiEndpoints.js HELPERS block for
// the full confirmed contract and why the fixed context fields below
// (price_list_id, document_id, exchange_rate, etc.) are safe constants.

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

/**
 * Recomputes rate/labour/tax/net_amount for one or more items against
 * today's live metal/stone rates.
 *
 * @param {object[]} items — full item objects as returned by
 *   Style/Retrieve's style_variants[] or Items/Retrieve (send unmodified,
 *   including their placeholder item_rate:0/item_labour:0 and full
 *   item_components[] BOM — the server needs the whole shape to recompute).
 *   `pieces` is force-set to 1 here regardless of the input — see below.
 * @returns {Promise<object[]>} same item shape, with item_rate, item_labour,
 *   sub_total, tax_amount, net_amount, and item_components[].rate/amount
 *   all recomputed against today's rates.
 */
export async function calculateItemRates(items) {
  if (!items?.length) return [];

  // `pieces` is overloaded in this codebase: useDesignVariants patches it to
  // the REAL per-store stock count (0 for Made-to-Order) for display
  // purposes, but SetSalesItems expects it as the BOM recipe quantity —
  // "cost of making one piece" — not a stock count. Confirmed live
  // 2026-07-22: sending pieces:0 (a real out-of-stock variant, patched by
  // useDesignVariants) reliably 500s the server (an unhandled exception,
  // presumably a divide-by-zero in its per-piece cost calc); the same item
  // with pieces:1 prices correctly. Force it to 1 here so callers never
  // have to remember to un-patch it before pricing.
  const pricedItems = items.map((item) => ({ ...item, pieces: 1 }));

  const response = await axiosInstance.post(API.HELPERS.SET_SALES_ITEMS, {
    selected_products:    pricedItems,
    price_list_id:        0,
    calculate_rates:      true,
    document_date:        new Date().toUTCString(),
    document_id:          52,
    exchange_rate:        1,
    generate_line_no:     false,
    generate_lot_no:      false,
    is_labour_applicable: true,
    is_purchase:          false,
    is_tax_applicable:    true,
  });

  return response.data?.Entities ?? [];
}
