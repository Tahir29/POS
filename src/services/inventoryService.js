// src/services/inventoryService.js
// Service functions for inventory and stock operations.

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

/**
 * Real-time stock check for a specific item SKU as of today.
 * @param {string} itemCode — item_code (SKU)
 */
export const getStock = (itemCode) =>
  axiosInstance.post(API.INVENTORY.GET_STOCK, {
    item_code: itemCode,
    to_date: new Date().toISOString().split('T')[0],
  });

/**
 * Cross-store stock breakdown for a specific item.
 * @param {number} itemId — item_id
 */
export const getStockByStores = (itemId) =>
  axiosInstance.post(API.CATALOG.GET_STOCK_BY_STORES, { item_id: itemId });

/**
 * The individual PHYSICAL PIECES of an item held at a store — one row per
 * piece, each with its own SKU, stock line number, location and cost.
 *
 * This is what OrnaVerse's own POS Invoice tab lists under "Browse Stock"
 * (captured from their UAT counter 2026-08-05). It is a different thing from
 * the product catalog: the catalog describes a PRODUCT, this returns the
 * actual items on the shelf. Billing needs the latter — see
 * checkoutPricingService for why.
 *
 * `has_sku: true` restricts to pieces that have been given a stock SKU, i.e.
 * real sellable inventory. `company_id` is essential: this table spans every
 * branch (1992 rows for HO alone), so omitting it can hand back a piece
 * sitting in another store.
 *
 * @param {{ itemId: number, companyId: number, take?: number }} params
 * @returns {Promise<import('axios').AxiosResponse>} { Entities: StockJournalRow[] }
 */
/**
 * Physical pieces on the shelf, one row per piece.
 *
 * Accepts either a single `itemId` or an `itemIds` array — the plural filter
 * is honoured server-side (verified on UAT 2026-08-05: querying two ids where
 * only one has stock returns just that one's rows, in either order). That is
 * what lets the catalog price a whole page of products against real pieces in
 * ONE call instead of one call per card.
 */
export const getStockPieces = ({ itemId, itemIds, companyId, take = 50 }) =>
  axiosInstance.post(API.INVENTORY.STOCK_JOURNAL_LIST, {
    Skip:       0,
    Take:       take,
    ...(itemIds?.length ? { item_ids: itemIds } : { item_id: itemId }),
    company_id: companyId,
    has_sku:    true,
  });

/**
 * Resolves a scanned barcode to the physical piece it was printed on, and
 * the item/product it belongs to.
 *
 * The barcode printed on a physical piece encodes `sku` (this row's own
 * per-piece identifier, e.g. "LJ082611756") — NOT `item_code` (the catalog/
 * style code, e.g. "LJ-R00604-18YGLGD-10", shared across every piece of that
 * style). The catalog barcode-scan handler previously matched only against
 * `item_code`, which is why a real physical-piece scan could never resolve.
 *
 * REQUEST SHAPE CONFIRMED 2026-08-09 from a live capture of OrnaVerse's OWN
 * UAT client performing this exact lookup: `{ sku, Take: 1 }` — nothing
 * else. Two earlier guesses here (adding `company_id`/`has_sku`, then also
 * an `EqualityFilter` wrapper) were both OVER-filtered relative to this —
 * they returned zero rows for a sku confirmed to exist. Mirror the real
 * shape exactly rather than adding anything back without live proof it
 * belongs.
 *
 * NOT server-side scoped to a store, unlike getStockPieces above — skus are
 * expected to be unique per physical piece, so this should rarely matter,
 * but callers that care should check the returned row's own `company_id`
 * rather than relying on a request-side filter that isn't part of the
 * confirmed shape.
 *
 * @param {{ sku: string }} params
 * @returns {Promise<import('axios').AxiosResponse>} { Entities: StockJournalRow[] }
 */
export const getStockPieceBySku = ({ sku }) =>
  axiosInstance.post(API.INVENTORY.STOCK_JOURNAL_LIST, {
    Skip: 0,
    Take: 1,
    sku,
  });

/**
 * Records an "item enquiry" — logs that this physical piece was looked up
 * (e.g. via barcode scan). CONFIRMED 2026-08-10 via a live network capture
 * on lucira.uat.ornaverse.in/pos: their own client fires this immediately
 * after StockJournal/List resolves the scanned sku, built entirely from
 * fields already present on that same row (item_id, item_attribute_id,
 * company_id, item_line_no, sku, image) plus a fresh timestamp in
 * `Date.toUTCString()` format (e.g. "Mon, 10 Aug 2026 10:47:41 GMT").
 *
 * This is a logging/analytics side effect on OrnaVerse's side (presumably
 * feeding an "items enquired about" report), NOT part of the actual scan-
 * to-product resolution — StockJournal/List alone already answers that.
 * Callers should fire this best-effort and never let its failure block or
 * fail the scan itself.
 *
 * @param {{ itemId: number, itemAttributeId: number, companyId: number,
 *   itemLineNo: number, sku: string, image?: string }} params
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export const createItemEnquiry = ({ itemId, itemAttributeId, companyId, itemLineNo, sku, image }) =>
  axiosInstance.post(API.INVENTORY.ITEM_ENQUIRIES_CREATE, {
    Entity: {
      item_id:           itemId,
      item_attribute_id: itemAttributeId,
      date:              new Date().toUTCString(),
      company_id:        companyId,
      item_line_no:      itemLineNo,
      sku,
      image:             image ?? '',
    },
  });