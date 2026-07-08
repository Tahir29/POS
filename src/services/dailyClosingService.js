// src/services/dailyClosingService.js
// POS Daily Closing — end-of-day cash reconciliation.
// No Post step — Create finalises immediately.
//
// DailyClosingRow key fields (from v1.json):
//   company_id       — store
//   closing_date     — date of closing
//   opening_balance  — cash at start of day
//   closing_balance  — cash at end of day (computed or entered)
//   cash_sales       — total cash sales for the day
//   card_sales       — total card sales for the day
//   upi_sales        — total UPI sales for the day
//   other_sales      — other payment mode totals
//   total_sales      — sum of all modes
//   notes            — optional remarks

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

/**
 * Create (and finalise) a daily closing entry.
 * No separate Post step — Create is terminal.
 * @param {object} closingEntity — DailyClosingRow fields
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function createDailyClosing(closingEntity) {
  const response = await axiosInstance.post(API.DAILY_CLOSING.CREATE, {
    Entity: closingEntity,
  });
  return response.data;
}

/**
 * Full detail of a single daily closing record.
 * @param {number} closingId — EntityId from the closing list
 * @returns {Promise<object>} { Entity: DailyClosingRow }
 */
export async function getDailyClosingDetail(closingId) {
  const response = await axiosInstance.post(API.DAILY_CLOSING.RETRIEVE, {
    EntityId: closingId,
  });
  return response.data;
}

/**
 * Paginated list of daily closing records for a store.
 * @param {{ take?: number, skip?: number, company_id?: number }} params
 * @returns {Promise<object>} { Entities[], TotalCount }
 */
export async function getDailyClosingList({ take = 30, skip = 0, company_id } = {}) {
  const response = await axiosInstance.post(API.DAILY_CLOSING.LIST, {
    Take:       take,
    Skip:       skip,
    company_id: company_id ?? undefined,
  });
  return response.data;
}
