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

/**
 * Prices actual STOCK PIECES for a sale — the checkout counterpart of
 * calculateItemRates.
 *
 * Captured verbatim from OrnaVerse's own UAT Invoice counter 2026-08-05.
 * Two things differ from the catalog-preview call above, and both matter:
 *
 *   • `selected_products` are StockJournal rows (real pieces), not item
 *     master records. SetSalesItems passes their identity fields straight
 *     through — item_line_no, sku, location_id, item_attribute_id and
 *     item_cost all survive into the response untouched, which is precisely
 *     how the Create payload comes to carry them. Feed it a master record
 *     instead and every one of those fields is absent or wrong.
 *   • `document_id` is the real document type (54 = POS Invoice), not the
 *     Estimation type 52 used for browsing. Their call also omits
 *     is_labour_applicable/is_purchase entirely.
 *
 * `pieces` is NOT forced to 1 here (unlike calculateItemRates): a stock row
 * already describes exactly one physical piece.
 *
 * @param {object[]} stockRows — rows from inventoryService.getStockPieces,
 *   passed through unmodified.
 * @param {number} documentId — the document type being raised.
 * @returns {Promise<object[]>} priced rows, ready to become line_items.
 */
export async function priceStockPiecesForSale(stockRows, documentId) {
  if (!stockRows?.length) return [];

  const response = await axiosInstance.post(API.HELPERS.SET_SALES_ITEMS, {
    selected_products: stockRows,
    price_list_id:     0,
    calculate_rates:   true,
    document_date:     new Date().toUTCString(),
    document_id:       documentId,
    exchange_rate:     1,
    generate_line_no:  false,
    generate_lot_no:   false,
    is_tax_applicable: true,
  });

  return response.data?.Entities ?? [];
}
