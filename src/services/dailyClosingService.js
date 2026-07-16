// src/services/dailyClosingService.js
// POS Daily Closing — end-of-day cash reconciliation.
// No Post step — Create finalises immediately.
//
// DailyClosingRow key fields — CORRECTED 2026-07-16 via direct API testing
// (the field the date is sent under is document_date, not closing_date —
// confirmed by a real validation error: "Closing Date field is required!"
// with Arguments: "document_date"):
//   company_id       — store
//   document_date    — date of closing (label is "Closing Date", field name is document_date)
//   opening_balance  — cash at start of day
//   closing_balance  — cash at end of day (computed or entered)
//   cash_sales       — total cash sales for the day
//   card_sales       — total card sales for the day
//   upi_sales        — total UPI sales for the day
//   other_sales      — other payment mode totals
//   total_sales      — sum of all modes
//   notes            — optional remarks
//
// KNOWN SERVER-SIDE ISSUE (confirmed 2026-07-16, NOT the AccessDenied
// permission gap seen on every other transaction type — this is a distinct,
// reproducible crash): both List and Create return a generic 500
// "Exception" the moment ANY field beyond the bare minimum is sent —
// company_id (or current_company_id, or company_id as a string, or
// company_ids[]) crashes List; adding document_id, opening_balance, or
// any other field beyond document_date crashes Create the same way, even
// though Create's own validator explicitly demanded a document_id field
// moments earlier. This isn't something a payload change on our side can
// fix — every plausible field-name variant hits the identical crash. Most
// likely explanation: the "Daily Closing" document type has no
// DocumentNumbering record configured in this environment (none of the
// ~60 document types seen via DocumentNumbering/List look like a closing
// doc), so the server's auto-numbering step NullReferences. Needs
// OrnaVerse's team to investigate — flag this as a distinct issue from the
// OAuth-scope AccessDenied problem affecting Order/Invoice/Return/etc.

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
 * company_id is deliberately NOT sent — see file header: any company
 * scoping param (in any spelling) crashes this endpoint with a 500 on this
 * UAT environment. Confirmed the bare call (Take/Skip only) works. This
 * means the list currently can't be scoped to the active store — it'll
 * show every store's closings until OrnaVerse fixes the endpoint.
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
