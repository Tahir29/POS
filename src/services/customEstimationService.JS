// Custom Estimation — pricing a bespoke piece that isn't in the catalog.
//
// CONFIRMED LIVE 2026-09-01 against UAT: item master has a boolean
// `allow_custom_estimation` flag on the Items/List row (NOT
// `is_custom_estimate` — that field name 500s, confirmed by testing it).
// Filtering Items/List by it returns exactly ONE item today: item_id
// 125282, "CUSTOM RING 18KT" — a placeholder BOM (one GOLD component,
// 18KT, purity 0.76, weight 1, rate 0) meant to be re-weighed per customer
// rather than sold as-is.
//
// There is no dedicated "Custom Estimation" endpoint family — it's the
// same Items/List + SetSalesItems pricing pipeline every other item in
// this app already goes through. See pricingService.js's
// calculateItemRates(), reused as-is for the actual price calculation
// (useCustomEstimateQuote.js).
//
// NOT wired to Estimation/Create — CONFIRMED STILL BROKEN live 2026-09-01
// (same 500 estimationService.js's header already documented from
// 2026-08-14): Create throws on ANY populated line_items, custom or
// catalog. This module is calculate-only until OrnaVerse fixes that.

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

/**
 * Item-master rows flagged for custom estimation (bespoke pieces re-priced
 * by weight rather than sold as a fixed SKU). Today there is exactly one,
 * but this doesn't assume that stays true.
 * @returns {Promise<object[]>} raw ItemsRow[] — same shape ItemSearchPicker
 *   already consumes elsewhere (item_id/item_code/item_name/item_components/...)
 */
export async function getCustomEstimateItems() {
  const response = await axiosInstance.post(API.ITEMS.LIST, {
    allow_custom_estimation: true,
    Take: 50,
  });
  return response.data?.Entities ?? [];
}