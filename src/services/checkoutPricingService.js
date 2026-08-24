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

    // FIX (2026-08-24, confirmed against OrnaVerse's OWN POS on UAT, not
    // just guessed at): the comment below about "comes back with no items"
    // was only ever true for SOME rejections. A component-scoped promotion
    // ("20% Off Diamond") on an item with zero diamond value gets a normal
    // 200 with the basket unchanged — the graceful case this function
    // already handled. But a flat/whole-value promotion applied to a gold
    // coin (e.g. "lucirablume5%") gets an outright 400: {"Error":{"Message":
    // "No items match the promotion criteria"}} — reproduced live in
    // OrnaVerse's own native POS, so this is a genuine server-side
    // eligibility rule (bullion/coin excluded from that class of promotion),
    // not a bug to route around. Before this try/catch, that 400 was
    // UNCAUGHT: it threw out of this whole function, failed
    // useCheckoutPricing's query for the ENTIRE cart, and disabled Place
    // Order — for every line, not just the gold coin — while giving the
    // operator no indication why. Caught here and folded into the exact
    // same "declined to price" path below, so it now reaches the operator
    // via CheckoutDiscountSection's existing "Doesn't apply to these items"
    // message instead of silently blocking the sale.
    let response;
    try {
      response = await applyPromotions({
        selected_products: lines,
        promotion:         promo.promoDetails,
        promotions:        promotionDetails,
        document_id:       documentId,
        exchange_rate:     exchangeRate,
      });
    } catch (err) {
      console.warn(
        `[checkoutPricingService] promotion "${promo.promoCode}" rejected by server`,
        err?.serverMessage ?? err?.message ?? err,
      );
      continue;
    }

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

  // Short stock is NOT an error here any more. The counter no longer asks the
  // operator to declare up front whether this is a bill or a booking, so a
  // basket the shelf can't fill simply becomes an order instead of a dead end.
  if (available.length < wanted) return null;

  const taken = available.slice(0, wanted);
  for (const row of taken) claimed.add(row.stock_journal_id);
  return taken;
}

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
 * Prices from the CATALOG ITEM MASTER — the made-to-order path.
 *
 * Used only when the shelf can't supply the basket. An order is a booking,
 * frequently for a piece the store doesn't have (their counter labels this
 * "(MTO)"). Doc 53 doesn't check stock, and their Order journey makes NO
 * StockJournal call at all: the master goes straight to SetSalesItems with
 * document_id 53. Confirmed 2026-08-05 by capturing that journey end to end.
 *
 * @returns {Promise<object[]>} one priced line per piece
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

/**
 * Prices the basket ONCE, and works out for itself what it is pricing.
 *
 * THE COUNTER NO LONGER ASKS. There used to be a "Complete as" choice —
 * Bill Now or Place Order — which meant the operator had to classify a sale
 * before knowing how it would be paid, and the two modes quoted different
 * figures for the same item. Two prices on one screen is a trust problem in
 * front of a customer, so the choice is gone.
 *
 * What's left is a fact, not a preference: either the shelf can supply this
 * basket or it can't.
 *
 *   every line in stock  → price the PHYSICAL PIECES (doc 54). This is the
 *     only shape an invoice can be raised from — a master-built invoice is
 *     refused with "Not enough stock of <code> can not Save", because it
 *     never names the piece leaving the shelf.
 *   anything short       → price the MASTERS (doc 53). Made-to-order; there
 *     is no piece to name, and only an order can be raised.
 *
 * The document type then follows from what was collected, at submit time.
 * Both are priced by the same server call against today's rates, so the
 * figure the customer is quoted is the figure they are charged either way.
 *
 * @param {{
 *   items: {itemId, itemName, styleId, quantity}[],
 *   activeStoreId: number,
 *   salesPersonId?: number,
 * }} params
 * @returns {Promise<{ lineItems: object[], isStockBacked: boolean }>}
 */
export async function buildPricedLineItems({ items, activeStoreId, salesPersonId }) {
  const claimed = new Set();

  // Sequential, not Promise.all — `claimed` is what stops two cart lines
  // claiming the same piece, and it only works if the claims don't race.
  const stockRows = [];
  let isStockBacked = true;
  for (const item of items) {
    const taken = await claimStockPieces({ item, activeStoreId, claimed });
    if (!taken) { isStockBacked = false; break; }
    stockRows.push(...taken);
  }

  const documentId = isStockBacked
    ? APP_CONFIG.DOCUMENT_TYPES.POS_INVOICE
    : APP_CONFIG.DOCUMENT_TYPES.POS_ORDER;

  const priced = isStockBacked
    ? await priceStockPiecesForSale(stockRows, documentId)
    : await buildOrderLineItems({ items, documentId });

  const expected = isStockBacked
    ? stockRows.length
    : items.reduce((sum, item) => sum + (item.quantity ?? 1), 0);

  if (priced.length !== expected) {
    throw new Error('Live pricing failed — the server priced a different number of items than were sent.');
  }

  // sales_person_id is the only field their client adds after pricing.
  const lineItems = salesPersonId == null
    ? priced
    : priced.map((row) => ({ ...row, sales_person_id: salesPersonId }));

  return { lineItems, isStockBacked };
}

/**
 * Maps priced line items back onto the cart lines that produced them.
 *
 * Both pricing paths emit ONE ROW PER PIECE, in cart order, expanding a cart
 * line of N into N consecutive rows — so the rows for cart line i are a
 * contiguous slice. This is what lets the checkout screen show each line at
 * the price it is really being sold for, and name the physical piece.
 *
 * @param {object[]} items      — cart items, in order
 * @param {object[]} lineItems  — buildPricedLineItems output
 * @returns {Map<number, { lineTotal: number, unitPrice: number, skus: string[] }>}
 *   keyed by cart index; empty when the two don't line up (never guess a
 *   mapping — showing the cart's own figure is better than the wrong piece's)
 */
export function mapPricedLinesToCart(items, lineItems) {
  const byCartIndex = new Map();
  if (!items?.length || !lineItems?.length) return byCartIndex;

  const expected = items.reduce((sum, item) => sum + (item.quantity ?? 1), 0);
  if (expected !== lineItems.length) return byCartIndex;

  let cursor = 0;
  items.forEach((item, index) => {
    const quantity = item.quantity ?? 1;
    const rows = lineItems.slice(cursor, cursor + quantity);
    cursor += quantity;

    const lineTotal = +rows.reduce((sum, r) => sum + (r.sub_total ?? 0), 0).toFixed(2);
    byCartIndex.set(index, {
      lineTotal,
      unitPrice: +(lineTotal / quantity).toFixed(2),
      // Only invoices claim stock rows, so this is empty for an order.
      skus: rows.map((r) => r.sku).filter(Boolean),
    });
  });

  return byCartIndex;
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
