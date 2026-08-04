// src/services/checkoutPricingService.js
// Builds Invoice/Order Create line_items[] from the REAL STOCK PIECES being
// sold — captured verbatim from OrnaVerse's own UAT sales counter on
// 2026-08-05, not inferred.
//
// ── WHY THIS IS BUILT ON STOCK ROWS, NOT CATALOG ITEMS ──────────────────
//
// This used to price the CATALOG record (Items/Retrieve or a Style variant)
// and hand the result to Create. That produces a payload the server accepts
// structurally but cannot fulfil, because it never names the physical piece
// leaving the shelf. Every such attempt was rejected with
//
//     "Not enough stock of <item_code> can not Save"
//
// which reads like the shelf is empty. It isn't — the item had stock the
// whole time. The message means "I could not find the piece you described".
//
// OrnaVerse's own POS makes the distinction visible in its UI: the
// Estimation tab browses "Catalog", the Invoice tab browses "Stock". Their
// stock picker lists one row per physical piece, each with its own SKU and
// LINE# (e.g. SKU LJ10251288, LINE# 2844). Billing consumes those rows.
//
// The captured journey, reproduced exactly below:
//
//   1. Inventory/StockJournal/List  { item_id, company_id, has_sku: true }
//        → one row per physical piece. The row already carries item_line_no,
//          sku, location_id, item_attribute_id and a real item_cost.
//   2. Helpers/SetSalesItems  { selected_products: [ ...those rows... ],
//                               document_id: 54 }
//        → prices them. Confirmed against the capture: the response is the
//          input row plus pricing; every identity field above passes through
//          untouched.
//   3. POS/Invoice/Create  { line_items: [ ...priced rows + sales_person_id ] }
//        → 200. The ONLY field their client adds after pricing is
//          sales_person_id — verified by diffing their SetSalesItems response
//          against their Create payload key by key.
//
// Three fields we previously fabricated are now simply correct because they
// arrive on the stock row:
//   • item_line_no — the STOCK LINE of the piece (2844), not a 1..n counter.
//     Sending a counter is what made the stock lookup fail.
//   • sku — the piece's stock SKU ("LJ10251288"), not the item code.
//   • item_cost — its real purchase cost (29758.13), not 0. It could never
//     be derived: across 12 sampled posted lines it tracks nothing in the
//     sale pricing, and no catalog or stock-summary endpoint exposes it.
//
// Re-pricing still happens at SUBMISSION time rather than trusting whatever
// was computed at add-to-cart, since metal rates move intraday.

import { getStockPieces } from '@/services/inventoryService';
import { priceStockPiecesForSale } from '@/services/pricingService';

/**
 * Claims the physical pieces a cart line will consume.
 *
 * One stock row IS one piece, so a cart line for 3 needs 3 distinct rows.
 * Claimed rows are tracked by stock_journal_id across the whole cart so the
 * same piece can never be billed twice — possible when the same product sits
 * in the cart under two lines (different size/style selections).
 *
 * @param {{ item: object, activeStoreId: number, claimed: Set<number> }} params
 * @returns {Promise<object[]>} exactly `item.quantity` stock rows
 * @throws when the store cannot supply that many pieces
 */
async function claimStockPieces({ item, activeStoreId, claimed }) {
  const response = await getStockPieces({
    itemId:    item.itemId,
    companyId: activeStoreId,
  });
  const rows = response?.data?.Entities ?? [];

  const available = rows.filter((r) => !claimed.has(r.stock_journal_id));
  const wanted = item.quantity ?? 1;

  if (available.length < wanted) {
    // Say which product and how short we are. The server's own message names
    // only the item code and no numbers, which leaves staff guessing.
    throw new Error(
      available.length === 0
        ? `"${item.itemName}" is not in stock at this store — it can't be billed here.`
        : `Only ${available.length} of "${item.itemName}" ${available.length === 1 ? 'is' : 'are'} in stock — ${wanted} requested.`
    );
  }

  const taken = available.slice(0, wanted);
  for (const row of taken) claimed.add(row.stock_journal_id);
  return taken;
}

/**
 * Builds Invoice/Order Create line_items[] from live cart items.
 *
 * Returns ONE LINE PER PHYSICAL PIECE, which is how the ERP models a sale —
 * a cart line for 2 becomes two line items, each with its own stock SKU and
 * line number. That is also why nothing is scaled by quantity any more: each
 * row already describes exactly one piece at its own weight and cost.
 *
 * `salesPersonId` is optional: useCheckoutPricing calls this to quote the
 * cart before a sales person has necessarily been picked, and the field is
 * stamped on at submit. It is the only thing OrnaVerse's own client adds
 * after pricing, so adding it later changes nothing else.
 *
 * @param {{
 *   items: {itemId, itemName, quantity}[],
 *   activeStoreId: number,
 *   salesPersonId?: number,
 *   documentId: number,
 * }} params
 * @returns {Promise<object[]>} line_items ready to attach to the Entity
 */
export async function buildPricedLineItems({ items, activeStoreId, salesPersonId, documentId }) {
  const claimed = new Set();

  // Sequential, not Promise.all — `claimed` is what stops two cart lines
  // claiming the same piece, and it only works if the claims don't race.
  const stockRows = [];
  for (const item of items) {
    stockRows.push(...await claimStockPieces({ item, activeStoreId, claimed }));
  }

  const priced = await priceStockPiecesForSale(stockRows, documentId);

  if (priced.length !== stockRows.length) {
    throw new Error('Live pricing failed — the server priced a different number of pieces than were sent.');
  }

  // sales_person_id is the only field their client adds after pricing.
  return salesPersonId == null
    ? priced
    : priced.map((row) => ({ ...row, sales_person_id: salesPersonId }));
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
