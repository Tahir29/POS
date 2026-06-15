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