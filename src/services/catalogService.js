// src/services/catalogService.js
// OrnaVerse Catalog + Items module.
// All functions are pure HTTP wrappers — no business logic.
//
// SCHEMA — Inventory.ProductCatalogRow key fields (confirmed v1.json):
//   item_id, item_code, item_name
//   price          — sale price (NOT item_rate — that's on OrderItemsRow)
//   compare_price  — original/MRP price for strikethrough display
//   style_id       — links to StyleRow (which has external_product_id for Shopify)
//   has_stock      — boolean
//   current_company_pieces — stock count at active store
//   total_pieces   — stock count across all stores
//   image, image_1 … image_8 — OrnaVerse image paths (may be null on UAT)
//   type_id, sub_type_id, karat_id, metal_color_id, item_size_id
//   NO external_product_id here — only on StyleRow via Style/Retrieve

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';
import APP_CONFIG from '@/constants/appConfig';

// ─── ITEMS (Master catalogue) ─────────────────────────────────────────────────

/**
 * Fetches featured items from the master items list.
 * @returns {Promise<object>} { Entities: ItemsRow[] }
 */
export async function getFeaturedItems() {
  const response = await axiosInstance.post(API.ITEMS.LIST, {
    is_featured: true,
    Take:        APP_CONFIG.PAGINATION.DEFAULT_TAKE,
  });
  return response.data;
}

/**
 * Fetches new-arrival items from the master items list.
 * @returns {Promise<object>} { Entities: ItemsRow[] }
 */
export async function getNewItems() {
  const response = await axiosInstance.post(API.ITEMS.LIST, {
    is_new: true,
    Take:   APP_CONFIG.PAGINATION.DEFAULT_TAKE,
  });
  return response.data;
}

/**
 * Full-text + filter search via master items list.
 * NOTE: Server-side search is unreliable on UAT.
 * Prefer useAllCatalog + client-side filtering for the catalog page.
 * @param {object} params
 */
export async function searchItems(params) {
  const {
    item_search,
    item_group_ids,
    type_ids,
    sub_type_ids,
    from_weight,
    to_weight,
    from_diamond_weight,
    to_diamond_weight,
  } = params;

  const response = await axiosInstance.post(API.ITEMS.LIST, {
    item_search:         item_search         ?? '',
    item_group_ids:      item_group_ids      ?? [],
    type_ids:            type_ids            ?? [],
    sub_type_ids:        sub_type_ids        ?? [],
    brand_ids:           [],
    collection_ids:      [],
    super_type_ids:      [],
    from_weight:         from_weight         ?? null,
    to_weight:           to_weight           ?? null,
    from_diamond_weight: from_diamond_weight ?? null,
    to_diamond_weight:   to_diamond_weight   ?? null,
  });
  return response.data;
}

// ─── CATALOG (Live store inventory) ───────────────────────────────────────────

/**
 * Paginated store-scoped product catalog with live stock.
 * Always send current_company_id = activeStoreId.
 *
 * @param {object}  params
 * @param {number}  params.current_company_id   — required
 * @param {number}  [params.Take]
 * @param {number}  [params.Skip]
 * @param {boolean} [params.show_out_of_stock]
 * @param {number[]}[params.type_ids]
 * @returns {Promise<object>} { Entities: ProductCatalogRow[], TotalCount }
 */
export async function getProducts(params) {
  const {
    current_company_id,
    Take              = APP_CONFIG.PAGINATION.CATALOG_TAKE,
    Skip              = 0,
    show_out_of_stock = false,
    ...rest
  } = params;

  const response = await axiosInstance.post(API.CATALOG.GET_PRODUCTS, {
    current_company_id,
    Take,
    Skip,
    show_out_of_stock,
    ...rest,
  });
  return response.data;
}

/**
 * Full catalog in one shot (Take: 0) for client-side search + filter + barcode.
 * Always fetches OOS items — client toggle decides what to show.
 * Cached by useAllCatalog for the session.
 *
 * @param {number} storeId — current_company_id
 * @returns {Promise<object>} { Entities: ProductCatalogRow[], TotalCount }
 */
export async function getAllProducts(storeId) {
  const response = await axiosInstance.post(API.CATALOG.GET_PRODUCTS, {
    current_company_id: storeId,
    Take:               0,
    Skip:               0,
    show_out_of_stock:  true,
  });
  return response.data;
}

/**
 * Cross-store stock for a single item (product detail page).
 * @param {number} itemId — item_id
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export async function getStockByStores(itemId) {
  const response = await axiosInstance.post(API.CATALOG.GET_STOCK_BY_STORES, {
    item_id: itemId,
  });
  return response.data;
}

/**
 * Cross-store stock for multiple items in a single call.
 * Use on catalog grid to show availability indicators without N+1 calls.
 * @param {number[]} itemIds — array of item_id values
 * @returns {Promise<object>} OrnaVerse batch stock response
 */
export async function getStockByStoresBatch(itemIds) {
  const response = await axiosInstance.post(API.CATALOG.GET_STOCK_BY_STORES_BATCH, {
    item_ids: itemIds,
  });
  return response.data;
}