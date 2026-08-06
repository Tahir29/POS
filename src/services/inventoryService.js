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