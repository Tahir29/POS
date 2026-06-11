// src/services/itemService.js
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

/**
 * Fetches all available item sizes (ring sizes, bangle sizes, etc.)
 */
export const getItemSizes = () =>
  axiosInstance.post(API.ITEMS.SIZES, { Take: 100 });

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