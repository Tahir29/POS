// src/services/catalogService.js
// OrnaVerse Catalog + Items module.
// All functions are pure HTTP wrappers. No business logic.
// Source of truth: API_MAPPING.md Sections 5 & 6
//
// Phase 4 functions: getFeaturedItems, getNewItems
// Phase 5 additions: getProducts

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

export const searchItems = async (params) => {
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
    item_search: item_search ?? '',
    item_group_ids: item_group_ids ?? [],
    type_ids: type_ids ?? [],
    sub_type_ids: sub_type_ids ?? [],
    brand_ids: [],
    collection_ids: [],
    super_type_ids: [],
    from_weight: from_weight ?? null,
    to_weight: to_weight ?? null,
    from_diamond_weight: from_diamond_weight ?? null,
    to_diamond_weight: to_diamond_weight ?? null,
  });

  return response.data;
};

/**
 * Fetches the store-scoped product catalog with real-time stock.
 * current_company_id (storeId) is required — always passed from active store context.
 * show_out_of_stock defaults to false to hide unavailable items.
 * Supports pagination via Take / Skip.
 * Maps to: POST Services/Inventory/ProductCatalog/List
 *
 * @param {Object} params
 * @param {number} params.current_company_id  - Active store ID (required)
 * @param {number} [params.Take]              - Page size (default: CATALOG_TAKE = 100)
 * @param {number} [params.Skip]              - Pagination offset (default: 0)
 * @param {boolean} [params.show_out_of_stock] - Include OOS items (default: false)
 * @param {number[]} [params.type_ids]        - Filter by category IDs
 * @param {number[]} [params.sub_type_ids]    - Filter by sub-category IDs
 * @param {number[]} [params.item_group_ids]  - Filter by item group IDs
 */
export async function getProducts(params) {
  const {
    current_company_id,
    Take = APP_CONFIG.PAGINATION.CATALOG_TAKE,
    Skip = 0,
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
