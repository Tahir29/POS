// Builds Invoice/Order Create line_items[] from the REAL STOCK PIECES being
// sold, captured from OrnaVerse's own UAT sales counter.
//
// Pricing the catalog record and handing the result to Create produces a
// payload the server accepts structurally but cannot fulfil, since it never
// names the physical piece leaving the shelf — every such attempt was
// rejected with "Not enough stock of <item_code> can not Save", which reads
// like the shelf is empty even when it isn't. The captured journey:
//
//   1. Inventory/StockJournal/List { item_id, company_id, has_sku: true }
//        → one row per physical piece, already carrying item_line_no, sku,
//          location_id, item_attribute_id and a real item_cost.
//   2. Helpers/SetSalesItems { selected_products: [...those rows...],
//                              document_id: 54 }
//        → prices them; every identity field above passes through untouched.
//   3. POS/Invoice/Create { line_items: [...priced rows + sales_person_id] }
//        → 200. sales_person_id is the only field added after pricing.
//
// item_line_no (the STOCK LINE of the physical piece, not a 1..n counter),
// sku (the piece's own stock SKU, not the item code) and item_cost (its real
// purchase cost, not 0 or derived) all arrive on the stock row rather than
// being fabricated.
//
// Re-pricing happens at SUBMISSION time rather than trusting whatever was
// computed at add-to-cart, since metal rates move intraday.
//
// An ORDER (document 53) is a different path entirely — a booking, usually
// for a piece not on the shelf ("MTO", made to order). It does not check
// stock: the item MASTER goes straight to SetSalesItems with document_id 53,
// with no StockJournal call at all. buildPricedLineItems branches on which
// path applies; see buildOrderLineItems.

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
 * for the captured contract.
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

    // A component-scoped promotion ("20% Off Diamond") on an item with zero
    // diamond value gets a normal 200 with the basket unchanged (handled by
    // the empty-items check below). But a flat/whole-value promotion applied
    // to an item ineligible for that promotion class (e.g. a gold coin) gets
    // an outright 400 "No items match the promotion criteria" — a genuine
    // server-side eligibility rule, not a bug to route around. Left uncaught,
    // that 400 fails pricing for the ENTIRE cart and disables Place Order for
    // every line, not just the ineligible one, with no indication why — so
    // it's caught here and folded into the same "declined to price" path,
    // reaching the operator via DiscountSection's "Doesn't apply to these
    // items" message instead of silently blocking the sale.
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
 * Fetches every stock candidate for ALL distinct item_ids in the cart in ONE
 * batched call, instead of one network round trip per distinct item.
 *
 * The only thing that genuinely needs per-item sequencing is the `claimed`
 * Set (stopping two lines claiming the same physical piece), which only
 * matters between lines sharing an item_id — getStockPieces' rows are
 * already scoped by item_id server-side, so the fetch itself is safe to
 * batch. getStockPieces' `itemIds` (plural) filter is already used the same
 * way to price a whole catalog page in one call.
 *
 * `take` is a SHARED ceiling across every distinct item_id in one flat,
 * Take-capped result set — not a guaranteed per-item page. A high-volume
 * item could in principle fill the whole shared cap and crowd a genuinely
 * in-stock low-volume item out of this batch entirely; claimStockPieces
 * below re-fetches (scoped to just that item) whenever this batch looks
 * insufficient, so that scenario still resolves correctly at the cost of one
 * extra call in that specific, uncommon case.
 *
 * @param {{itemId:number}[]} items
 * @param {number} activeStoreId
 * @returns {Promise<Map<number, object[]>>} item_id → its stock rows
 */
async function fetchStockCandidatesByItemId({ items, activeStoreId }) {
  const distinctItemIds = [...new Set(items.map((item) => item.itemId))];
  if (distinctItemIds.length === 0) return new Map();

  const response = await getStockPieces({
    itemIds:   distinctItemIds,
    companyId: activeStoreId,
    take:      distinctItemIds.length * 50,
  });
  const rows = response?.data?.Entities ?? [];

  const byItemId = new Map();
  for (const row of rows) {
    const bucket = byItemId.get(row.item_id);
    if (bucket) bucket.push(row);
    else byItemId.set(row.item_id, [row]);
  }
  return byItemId;
}

/**
 * Claims the physical pieces a cart line will consume, from candidates
 * already fetched by fetchStockCandidatesByItemId — purely in-memory, no
 * network call of its own.
 *
 * One stock row IS one piece, so a cart line for 3 needs 3 distinct rows.
 * Claimed rows are tracked by stock_journal_id across the whole cart so the
 * same piece can never be billed twice — possible when the same product sits
 * in the cart under two lines (different size/style selections).
 *
 * Every StockJournal row carries `is_allocated`, a real flag meaning the row
 * may already be reserved by ANOTHER transaction. This is what "in stock"
 * actually means to OrnaVerse's own Invoice flow — not merely "a row exists
 * for this item" but "a row exists AND nothing else has already claimed it".
 * It's filtered out here alongside the in-session `claimed` set (`claimed`
 * stops double-claiming within THIS cart; `is_allocated` stops claiming a
 * piece some OTHER transaction already holds) — this filter is the actual
 * mechanism that decides whether a cart becomes an Invoice (stock-backed) or
 * an Order (made-to-order).
 *
 * `item.fulfillmentItemLineNo` (set by orderFulfillmentService's
 * mapFulfillmentLineToCartItem) steers this to claim the SAME physical piece
 * a source order already reserved, instead of an arbitrary one of the same
 * item_id — required for the source order to actually close out
 * server-side, and to stop two open orders on the same style from claiming
 * each other's piece.
 *
 * @param {{ item: object, activeStoreId: number, claimed: Set<number>, candidatesByItemId: Map<number, object[]> }} params
 * @returns {Promise<object[]>} exactly `item.quantity` stock rows
 * @throws when the store cannot supply that many pieces, or (fulfillment
 *   only) when the specific reserved piece is no longer available
 */
async function claimStockPieces({ item, activeStoreId, claimed, candidatesByItemId }) {
  let rows = candidatesByItemId.get(item.itemId) ?? [];
  let available = rows.filter((r) => !r.is_allocated && !claimed.has(r.stock_journal_id));

  // Only re-fetches (scoped to just THIS item_id) when the shared batch looks
  // insufficient for what THIS item needs — see this function's header for
  // why the shared batch can legitimately come up short for one item even
  // though it genuinely has stock. The common case (every item's fair share
  // already in the batch) never pays this extra call.
  const neededForThisItem = item.fulfillmentItemLineNo != null ? 1 : (item.quantity ?? 1);
  if (available.length < neededForThisItem) {
    const response = await getStockPieces({ itemId: item.itemId, companyId: activeStoreId });
    rows = response?.data?.Entities ?? [];
    available = rows.filter((r) => !r.is_allocated && !claimed.has(r.stock_journal_id));
  }

  if (item.fulfillmentItemLineNo != null) {
    // Fulfilling a specific order line — only the one piece it reserved will
    // do. Falling back to a different piece of the same item_id would still
    // complete A sale, but silently stop being "fulfillment" (the source
    // order would never close out, since correlation is keyed off this exact
    // item_line_no) — surfacing a clear error beats an operator believing
    // they fulfilled an order they didn't.
    const row = available.find((r) => r.item_line_no === item.fulfillmentItemLineNo);
    if (!row) {
      throw new Error(
        `"${item.itemName}" is no longer available to fulfill — the reserved piece may have just been claimed by another sale. Refresh "Fulfill from Order" and try again.`
      );
    }
    claimed.add(row.stock_journal_id);
    return [row];
  }

  const wanted = item.quantity ?? 1;

  // Short stock is NOT an error here — a basket the shelf can't fill simply
  // becomes an order instead of a dead end.
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
 * Used only when the shelf can't supply the basket ("(MTO)" on their own
 * counter). Doc 53 doesn't check stock: the master goes straight to
 * SetSalesItems with document_id 53, no StockJournal call at all.
 *
 * @returns {Promise<object[]>} one priced line per piece
 */
async function buildOrderLineItems({ items, documentId }) {
  // No shared mutable state across items here (unlike claimStockPieces), so
  // this runs concurrently rather than one item at a time.
  //
  // allSettled, not Promise.all: Promise.all rejects on whichever promise
  // fails first CHRONOLOGICALLY, not first by cart order, so if two items'
  // lookups both fail the error could name whichever happened to reject
  // faster. allSettled always resolves, so the check below walks `items` in
  // cart order and reports the first genuine failure deterministically.
  const settled = await Promise.allSettled(
    items.map((item) => resolveFullItem({ itemId: item.itemId, styleId: item.styleId }))
  );

  const masters = [];
  items.forEach((item, i) => {
    const result = settled[i];
    if (result.status === 'rejected') throw result.reason;
    const master = result.value;
    if (!master) {
      throw new Error(`"${item.itemName}" could not be priced — its product record was not found.`);
    }
    // One line per piece, matching how the invoice path models a sale and
    // how the header's `pieces` aggregate is summed.
    for (let p = 0; p < (item.quantity ?? 1); p += 1) masters.push(master);
  });

  const priced = await calculateItemRates(masters, documentId);
  if (priced.length !== masters.length) {
    throw new Error('Live pricing failed — the server priced a different number of items than were sent.');
  }
  return priced;
}

/**
 * Prices the basket ONCE, and works out for itself what it is pricing.
 *
 * The counter no longer asks the operator to classify the sale as "Bill Now"
 * or "Place Order" up front — that meant quoting two different figures for
 * the same item before either was known to be true, which is a trust problem
 * in front of a customer. Instead:
 *
 *   every line in stock  → price the PHYSICAL PIECES (doc 54). This is the
 *     only shape an invoice can be raised from — a master-built invoice is
 *     refused with "Not enough stock of <code> can not Save", because it
 *     never names the piece leaving the shelf.
 *   anything short       → price the MASTERS (doc 53). Made-to-order; there
 *     is no piece to name, and only an order can be raised.
 *
 * The document type follows from what was collected, at submit time. Both
 * are priced by the same server call against today's rates, so the figure
 * the customer is quoted is the figure they are charged either way.
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

  // ONE network round trip for every distinct item_id in the cart — see
  // fetchStockCandidatesByItemId's header comment.
  const candidatesByItemId = await fetchStockCandidatesByItemId({ items, activeStoreId });

  // The CLAIMING itself stays sequential, in cart order — `claimed` is what
  // stops two cart lines claiming the same piece, and it only works if the
  // claims don't race. Usually pure in-memory bookkeeping (no network wait);
  // still `await`ed because claimStockPieces can fall back to a scoped
  // per-item re-fetch when the shared batch came up short for one item (see
  // its own header comment) — a rare path, not the common case.
  const stockRows = [];
  let isStockBacked = true;
  for (const item of items) {
    const taken = await claimStockPieces({ item, activeStoreId, claimed, candidatesByItemId });
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
 * @param {object[]} lineItems  — buildPricedLineItems output, AFTER
 *   applyPromotionsToLines has run if any promo is applied — that's what
 *   writes the per-row `discount` field this also surfaces (see
 *   summarizeLineItems for the same sum used in the header total).
 * @returns {Map<number, {
 *   lineTotal: number, unitPrice: number, discount: number, skus: string[],
 *   breakdown: object,
 * }>}
 *   keyed by cart index; empty when the two don't line up (never guess a
 *   mapping — showing the cart's own figure is better than the wrong piece's)
 */
export function mapPricedLinesToCart(items, lineItems) {
  const byCartIndex = new Map();
  if (!items?.length || !lineItems?.length) return byCartIndex;

  const expected = items.reduce((sum, item) => sum + (item.quantity ?? 1), 0);
  if (expected !== lineItems.length) return byCartIndex;

  // ONE traversal of `rows` accumulating every field this line needs, rather
  // than a separate .reduce() pass per field — this runs on every
  // cart/checkout render, for every cart line.
  const emptyTotals = () => ({
    sub_total: 0, discount: 0, metal_amount: 0, diamond_amount: 0,
    stone_amount: 0, color_stone_amount: 0, other_amount: 0,
    item_labour: 0, taxable_amount: 0, tax_amount: 0, net_amount: 0,
    skus: [],
  });
  const round2 = (n) => +n.toFixed(2);

  let cursor = 0;
  items.forEach((item, index) => {
    const quantity = item.quantity ?? 1;
    const rows = lineItems.slice(cursor, cursor + quantity);
    cursor += quantity;

    const totals = rows.reduce((acc, r) => {
      acc.sub_total          += r.sub_total ?? 0;
      acc.discount           += r.discount ?? 0;
      acc.metal_amount       += r.metal_amount ?? 0;
      acc.diamond_amount     += r.diamond_amount ?? 0;
      acc.stone_amount       += r.stone_amount ?? 0;
      acc.color_stone_amount += r.color_stone_amount ?? 0;
      acc.other_amount       += r.other_amount ?? 0;
      acc.item_labour        += r.item_labour ?? 0;
      acc.taxable_amount     += r.taxable_amount ?? 0;
      acc.tax_amount         += r.tax_amount ?? 0;
      acc.net_amount         += r.net_amount ?? 0;
      if (r.sku) acc.skus.push(r.sku);
      return acc;
    }, emptyTotals());

    const lineTotal = round2(totals.sub_total);
    byCartIndex.set(index, {
      lineTotal,
      unitPrice: +(lineTotal / quantity).toFixed(2),
      // How much of the cart-wide discount landed on THIS line specifically.
      // A component-scoped promo ("20% Off Diamond") can give ₹0 here on a
      // line with no diamond even while it discounts others — correct, not a
      // bug.
      discount: round2(totals.discount),
      // Only invoices claim stock rows, so this is empty for an order.
      skus: totals.skus,
      // Full per-product cost breakdown — same fields/shape components
      // already render on the product detail page (metal/diamond/stone/
      // colour-stone/other + making charges + subtotal/taxable/tax/total),
      // summed across every physical piece this line represents. Deliberately
      // the SAME snake_case field names SetSalesItems itself uses so this
      // object can be handed straight to <PriceBreakdown priced={...} /> with
      // no remapping.
      breakdown: {
        metal_amount:       round2(totals.metal_amount),
        diamond_amount:     round2(totals.diamond_amount),
        stone_amount:       round2(totals.stone_amount),
        color_stone_amount: round2(totals.color_stone_amount),
        other_amount:       round2(totals.other_amount),
        item_labour:        round2(totals.item_labour),
        sub_total:          lineTotal,
        taxable_amount:     round2(totals.taxable_amount),
        tax_amount:         round2(totals.tax_amount),
        net_amount:         round2(totals.net_amount),
      },
    });
  });

  return byCartIndex;
}

/**
 * Sums the authoritative per-line totals (computed by SetSalesItems, not the
 * cart's display-only flat-3%-GST estimate) into header-level figures —
 * including the aggregate pieces/weight/net_weight the header itself
 * carries.
 * @param {object[]} lineItems — output of buildPricedLineItems
 */
export function summarizeLineItems(lineItems) {
  // ONE traversal of `lineItems` (one row per physical piece in the whole
  // order) accumulating every header field, rather than a separate .reduce()
  // pass per field.
  const totals = lineItems.reduce((acc, li) => {
    acc.sub_total      += li.sub_total ?? 0;
    acc.discount        += li.discount ?? 0;
    acc.taxable_amount  += li.taxable_amount ?? 0;
    acc.tax_amount      += li.tax_amount ?? 0;
    acc.net_amount      += li.net_amount ?? 0;
    acc.pieces          += li.pieces ?? 0;
    acc.weight          += li.weight ?? 0;
    acc.net_weight      += li.net_weight ?? 0;
    return acc;
  }, {
    sub_total: 0, discount: 0, taxable_amount: 0, tax_amount: 0,
    net_amount: 0, pieces: 0, weight: 0, net_weight: 0,
  });

  const round2 = (n) => +n.toFixed(2);
  return {
    subTotal:      round2(totals.sub_total),
    // Post-promotion figures when ApplyPromotions has run: it writes the
    // discount onto each line and recomputes taxable_amount/tax_amount/
    // net_amount around it, leaving base_* holding the pre-discount values.
    // Summing what the lines actually carry is therefore correct either way,
    // matching what the real header does.
    discount:      round2(totals.discount),
    taxableAmount: round2(totals.taxable_amount),
    taxAmount:     round2(totals.tax_amount),
    netAmount:     round2(totals.net_amount),
    pieces:        round2(totals.pieces),
    weight:        round2(totals.weight),
    netWeight:     round2(totals.net_weight),
  };
}
