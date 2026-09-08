// Service functions for product item master data.
// One function per endpoint — no business logic.

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

/**
 * Fetches full product detail for a single item.
 * @param {number} entityId — item_id from catalog
 */
export const getItemDetail = (entityId) =>
  axiosInstance.post(API.ITEMS.RETRIEVE, { EntityId: entityId });

// REMOVED 2026-09-08 — getItemSizes() had zero callers anywhere (confirmed
// via a dead-code audit) — size options are sourced from useDesignVariants'
// own per-style variant list wherever this app needs them (CustomizeSheet),
// not a standalone master sizes list. API.ITEMS.SIZES is untouched in
// apiEndpoints.js in case a standalone sizes list is needed later.

/**
 * Fetches product attributes of a specific type
 * (e.g. purity, stone type, finish).
 * @param {number} attributeTypeId
 */
export const getItemAttributes = (attributeTypeId) =>
  axiosInstance.post(API.ITEMS.ATTRIBUTES, {
    Take: 0,
    attribute_type_id: attributeTypeId,
  });

/**
 * Fetches all style variants for a given style_id.
 * Returns style_variants[] — each variant is a purchasable SKU
 * with its own item_id, karat, metal color, and size.
 * Maps to: POST Services/Master/Style/GetDesigns
 * @param {number} styleId — style_id from Items/Retrieve
 */
export const getDesignVariants = (styleId) =>
  axiosInstance.post(API.ITEMS.DESIGN_DETAIL, {
    EntityId: styleId,
  });

/**
 * Search the master item catalogue by SKU/code substring — NOT scoped to
 * current-store stock (unlike catalogService's searchBySku). Used by
 * Exchange/Buyback, where the item being handed in by the customer isn't
 * necessarily in this store's live stock; only its master record (weight,
 * purity, item_rate) matters for valuation.
 *
 * item_search matches item_code substrings only (confirmed elsewhere in
 * this app) — not item_name.
 * @param {string} query
 * @returns {Promise<object>} { Entities: ItemRow[] }
 */
export async function searchMasterItems(query) {
  if (!query || query.trim().length < 2) return { Entities: [] };
  const response = await axiosInstance.post(API.ITEMS.LIST, {
    item_search: query.trim(),
    Take: 20,
  });
  return response.data;
}