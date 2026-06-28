// src/services/dailyClosingService.js
// POS Daily Closing — end-of-day cash and stock reconciliation.
// All functions are pure HTTP wrappers — no business logic.
//
// No Post step — DailyClosing uses Create/Update only.
// Triggered by the store manager at end of trading day.
// Locks the day's transactions and reconciles cash drawer.

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

/**
 * List of daily closing records for this store.
 * @param {{ take?: number, skip?: number, company_id?: number }} params
 * @returns {Promise<object>} { Entities[], TotalCount }
 */
export async function getDailyClosings({ take = 30, skip = 0, company_id } = {}) {
  const response = await axiosInstance.post(API.DAILY_CLOSING.LIST, {
    Take:       take,
    Skip:       skip,
    company_id: company_id ?? undefined,
  });
  return response.data;
}

/**
 * Full detail of a single daily closing.
 * @param {number} closingId — EntityId
 * @returns {Promise<object>} { Entity: DailyClosingRow }
 */
export async function getDailyClosingDetail(closingId) {
  const response = await axiosInstance.post(API.DAILY_CLOSING.RETRIEVE, {
    EntityId: closingId,
  });
  return response.data;
}

/**
 * Create an end-of-day closing record.
 * @param {object} closingEntity — DailyClosingRow fields
 *   Required: company_id, closing_date, cash_in_hand
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function createDailyClosing(closingEntity) {
  const response = await axiosInstance.post(API.DAILY_CLOSING.CREATE, {
    Entity: closingEntity,
  });
  return response.data;
}