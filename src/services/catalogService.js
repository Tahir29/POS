// src/services/catalogService.js
// OrnaVerse Catalog + Items module.
// All functions are pure HTTP wrappers. No business logic.
// Source of truth: API_MAPPING.md Sections 5 & 6

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';
import APP_CONFIG from '@/constants/appConfig';

/**
 * Fetches featured items from the master items list.
 * Maps to: POST Services/Master/Items/List (is_featured: true)
 */
export async function getFeaturedItems() {
  const response = await axiosInstance.post(API.ITEMS.LIST, {
    is_featured: true,
    Take: APP_CONFIG.PAGINATION.DEFAULT_TAKE,
  });
  return response.data;
}

/**
 * Fetches new-arrival items from the master items list.
 * Maps to: POST Services/Master/Items/List (is_new: true)
 */
export async function getNewItems() {
  const response = await axiosInstance.post(API.ITEMS.LIST, {
    is_new: true,
    Take: APP_CONFIG.PAGINATION.DEFAULT_TAKE,
  });
  return response.data;
}

/**
 * Full-text + filter search via master items list.
 * NOTE: This endpoint is currently unreliable on UAT.
 * Kept for reference — useAllCatalog + client-side filtering is used instead.
 * Maps to: POST Services/Master/Items/List
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
    item_search:          item_search          ?? '',
    item_group_ids:       item_group_ids       ?? [],
    type_ids:             type_ids             ?? [],
    sub_type_ids:         sub_type_ids         ?? [],
    brand_ids:            [],
    collection_ids:       [],
    super_type_ids:       [],
    from_weight:          from_weight          ?? null,
    to_weight:            to_weight            ?? null,
    from_diamond_weight:  from_diamond_weight  ?? null,
    to_diamond_weight:    to_diamond_weight    ?? null,
  });

  return response.data;
}

/**
 * Fetches store-scoped product catalog with real-time stock — paginated.
 * current_company_id (storeId) is required.
 * Maps to: POST Services/Inventory/ProductCatalog/List
 *
 * @param {Object}   params
 * @param {number}   params.current_company_id
 * @param {number}   [params.Take]
 * @param {number}   [params.Skip]
 * @param {boolean}  [params.show_out_of_stock]
 * @param {number[]} [params.type_ids]
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
 * Fetches the FULL product catalog for a store in one shot (Take: 0).
 * Used by useAllCatalog for client-side search, filter, sort, and barcode lookup.
 * Always requests OOS items too — client-side toggle decides what to show.
 * Maps to: POST Services/Inventory/ProductCatalog/List
 *
 * @param {number} storeId - current_company_id of the store to scope to
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