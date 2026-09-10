// POS Daily Closing — end-of-day cash reconciliation.
// No Post step — Create finalises immediately.
// company_id is deliberately NOT sent on List — see getDailyClosingList below.

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
 * Paginated list of daily closing records.
 *
 * company_id is deliberately NOT sent — this endpoint 500s on this
 * environment when any field beyond Take/Skip is included, so the list
 * currently can't be scoped to the active store.
 * @param {{ take?: number, skip?: number }} params
 * @returns {Promise<object>} { Entities[], TotalCount }
 */
export async function getDailyClosingList({ take = 30, skip = 0 } = {}) {
  const response = await axiosInstance.post(API.DAILY_CLOSING.LIST, {
    Take: take,
    Skip: skip,
  });
  return response.data;
}

/**
 * Real payment-mode receipt totals for a store on a given date, used to give
 * the manual EOD entry something to check against (not to auto-file it).
 * Uses Reports/CustomerHistory/TotalReceipts, which also accepts a plain
 * company_id + date-range scope despite being built for customer history.
 * @param {{ companyId: number, fromDate: string, toDate: string }} params — ISO date-times
 * @returns {Promise<object>} { Entities: {mode, frequency, amount}[] }
 */
export async function getReceiptModeTotals({ companyId, fromDate, toDate }) {
  const response = await axiosInstance.post(API.CUSTOMER_HISTORY.TOTAL_RECEIPTS, {
    company_id: companyId,
    from_date:  fromDate,
    to_date:    toDate,
  });
  return response.data;
}
