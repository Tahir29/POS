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
//
// ── ORDERS TAKE A DIFFERENT PATH ENTIRELY ────────────────────────────────
//
// Everything above is the INVOICE journey. An ORDER (document 53) is a
// booking, usually for a piece that is NOT on the shelf — their own counter
// marks it "(MTO)", made to order — and doc 53 does not check stock. Their
// Order journey, captured 2026-08-05, makes NO StockJournal call at all: the
// item MASTER goes straight to SetSalesItems with document_id 53. So
// buildPricedLineItems branches on the document type; see buildOrderLineItems.

import { getStockPieces } from '@/services/inventoryService';
import { getItemDetail, getDesignVariants } from '@/services/itemService';
import { priceStockPiecesForSale, calculateItemRates } from '@/services/pricingService';
import { applyPromotions } from '@/services/promotionService';
import APP_CONFIG from '@/constants/appConfig';

/**
 * Applies every selected promotion to already-priced lines, through
 * OrnaVerse's own calculator.
 *
 * A promotion's value is not something this client can work out — the
 * percentage applies to a COMPONENT of the item chosen by
 * `discount_calc_on` (diamond / making charges / whole value), and the
 * server re-taxes the line afterwards. See promotionService.applyPromotions
 * for the captured contract and the numbers that prove it.
 *
 * Promotions fold in sequence: each round is handed the previous round's
 * lines and the promotion rows raised so far, exactly as their POS does it.
 * Only the newest row comes back each time, so they are accumulated here.
 *
 * @param {{
 *   lineItems: object[],
 *   appliedPromos: {promoCode: string, promoDetails: object}[],
 *   documentId: number,
 *   exchangeRate?: number,
 * }} params
 * @returns {Promise<{ lineItems: object[], promotionDetails: object[] }>}
 */
export async function applyPromotionsToLines({
  lineItems, appliedPromos, documentId, exchangeRate = 1,
}) {
  if (!appliedPromos?.length) return { lineItems, promotionDetails: [] };

  let lines = lineItems;
  let promotionDetails = [];

  for (const promo of appliedPromos) {
    if (!promo?.promoDetails) continue;

    const response = await applyPromotions({
      selected_products: lines,
      promotion:         promo.promoDetails,
      promotions:        promotionDetails,
      document_id:       documentId,
      exchange_rate:     exchangeRate,
    });

    const items = response?.data?.items;
    const rows  = response?.data?.invoice_promotions ?? [];

    // A promotion the server declines to price (not applicable to anything in
    // the basket) comes back with no items. Leave the lines as they were
    // rather than dropping the basket on the floor.
    if (!Array.isArray(items) || items.length !== lines.length) continue;

    lines = items;
    promotionDetails = [...promotionDetails, ...rows];
  }

  return { lineItems: lines, promotionDetails };
}

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
/**
 * Resolves a cart item back to its FULL master record — the Style variant
 * when we know the style, else the plain Items/Retrieve Entity. Both shapes
 * carry the item_components[] BOM that SetSalesItems recomputes against.
 */
async function resolveFullItem({ itemId, styleId }) {
  if (styleId) {
    const response = await getDesignVariants(styleId);
    const variants = response?.data?.Entity?.style_variants ?? [];
    const variant = variants.find((v) => v.item_id === itemId);
    if (variant) return variant;
    // Fall through rather than failing checkout outright for an item whose
    // style lookup didn't happen to include it.
  }
  const response = await getItemDetail(itemId);
  return response?.data?.Entity ?? null;
}

/**
 * Prices an ORDER's lines from the CATALOG ITEM MASTER, not from stock.
 *
 * An order is a booking, frequently for a piece the store does not have —
 * their own counter labels exactly this case "(MTO)", made to order. Doc 53
 * does not check stock, and their Order journey makes NO StockJournal call
 * at all: it sends the item master straight to SetSalesItems with
 * document_id 53. Confirmed 2026-08-05 by capturing that journey end to end.
 *
 * Routing an order through the invoice's stock-piece path would refuse every
 * made-to-order item — which is most of what orders exist for.
 *
 * @returns {Promise<object[]>} one priced line per cart line
 */
async function buildOrderLineItems({ items, documentId }) {
  const masters = [];
  for (const item of items) {
    const master = await resolveFullItem({ itemId: item.itemId, styleId: item.styleId });
    if (!master) {
      throw new Error(`"${item.itemName}" could not be priced — its product record was not found.`);
    }
    // One line per piece, matching how the invoice path models a sale and
    // how the header's `pieces` aggregate is summed.
    for (let i = 0; i < (item.quantity ?? 1); i += 1) masters.push(master);
  }

  const priced = await calculateItemRates(masters, documentId);
  if (priced.length !== masters.length) {
    throw new Error('Live pricing failed — the server priced a different number of items than were sent.');
  }
  return priced;
}

export async function buildPricedLineItems({ items, activeStoreId, salesPersonId, documentId }) {
  // ORDER (53) books a catalog item; INVOICE (54) consumes a physical piece.
  // See buildOrderLineItems for why these cannot share a path.
  if (documentId === APP_CONFIG.DOCUMENT_TYPES.POS_ORDER) {
    const orderLines = await buildOrderLineItems({ items, documentId });
    return salesPersonId == null
      ? orderLines
      : orderLines.map((row) => ({ ...row, sales_person_id: salesPersonId }));
  }

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
    // Post-promotion figures when ApplyPromotions has run: it writes the
    // discount onto each line and recomputes taxable_amount/tax_amount/
    // net_amount around it, leaving base_* holding the pre-discount values.
    // Summing what the lines actually carry is therefore correct either way,
    // and is what their own header does — confirmed field for field against a
    // real Order/Create (discount 12177.6, taxable 92521.44, tax 2775.64).
    discount:      sum('discount'),
    taxableAmount: sum('taxable_amount'),
    taxAmount:     sum('tax_amount'),
    netAmount:     sum('net_amount'),
    pieces:        sum('pieces'),
    weight:        sum('weight'),
    netWeight:     sum('net_weight'),
  };
}
