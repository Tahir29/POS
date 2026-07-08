// src/services/reportsService.js
// Operational POS reports — status reports, receipt summaries, tax details.
// All functions are pure HTTP wrappers — no business logic.
//
// These are list-based reports used on the /reports page.
// They return pre-aggregated or filtered transaction data.

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

// ─── RECEIPT REPORTS ─────────────────────────────────────────────────────────

/**
 * POS receipts summary report.
 * @param {{ company_id: number, from_date: string, to_date: string }} params
 * @returns {Promise<object>} { Entities[], TotalCount }
 */
export async function getPOSReceiptsReport({ company_id, from_date, to_date }) {
  const response = await axiosInstance.post(API.REPORTS.POS_RECEIPTS, {
    company_id,
    from_date,
    to_date,
  });
  return response.data;
}

/**
 * POS receipts detailed report (mode-wise breakdown).
 * @param {{ company_id: number, from_date: string, to_date: string }} params
 * @returns {Promise<object>} { Entities[], TotalCount }
 */
export async function getPOSReceiptsDetailedReport({ company_id, from_date, to_date }) {
  const response = await axiosInstance.post(API.REPORTS.POS_RECEIPTS_DETAILED, {
    company_id,
    from_date,
    to_date,
  });
  return response.data;
}

// ─── TAX REPORT ──────────────────────────────────────────────────────────────

/**
 * POS tax details report (GST breakdown per invoice).
 * @param {{ company_id: number, from_date: string, to_date: string }} params
 * @returns {Promise<object>} { Entities[], TotalCount }
 */
export async function getPOSTaxDetails({ company_id, from_date, to_date }) {
  const response = await axiosInstance.post(API.REPORTS.POS_TAX_DETAILS, {
    company_id,
    from_date,
    to_date,
  });
  return response.data;
}

// ─── TRANSACTION STATUS REPORTS ───────────────────────────────────────────────

/**
 * Return status report.
 * @param {{ company_id: number, from_date?: string, to_date?: string }} params
 */
export async function getReturnStatusReport({ company_id, from_date, to_date } = {}) {
  const response = await axiosInstance.post(API.REPORTS.RETURN_STATUS, {
    company_id,
    from_date: from_date ?? undefined,
    to_date:   to_date   ?? undefined,
  });
  return response.data;
}

/**
 * Exchange status report.
 * @param {{ company_id: number, from_date?: string, to_date?: string }} params
 */
export async function getExchangeStatusReport({ company_id, from_date, to_date } = {}) {
  const response = await axiosInstance.post(API.REPORTS.EXCHANGE_STATUS, {
    company_id,
    from_date: from_date ?? undefined,
    to_date:   to_date   ?? undefined,
  });
  return response.data;
}

/**
 * Credit note status report.
 * @param {{ company_id: number, from_date?: string, to_date?: string }} params
 */
export async function getCreditNoteStatusReport({ company_id, from_date, to_date } = {}) {
  const response = await axiosInstance.post(API.REPORTS.CREDIT_NOTE_STATUS, {
    company_id,
    from_date: from_date ?? undefined,
    to_date:   to_date   ?? undefined,
  });
  return response.data;
}

/**
 * Buy back status report.
 * @param {{ company_id: number, from_date?: string, to_date?: string }} params
 */
export async function getBuybackStatusReport({ company_id, from_date, to_date } = {}) {
  const response = await axiosInstance.post(API.REPORTS.BUYBACK_STATUS, {
    company_id,
    from_date: from_date ?? undefined,
    to_date:   to_date   ?? undefined,
  });
  return response.data;
}

/**
 * URD purchase status report.
 * @param {{ company_id: number, from_date?: string, to_date?: string }} params
 */
export async function getURDPurchaseStatusReport({ company_id, from_date, to_date } = {}) {
  const response = await axiosInstance.post(API.REPORTS.URD_PURCHASE_STATUS, {
    company_id,
    from_date: from_date ?? undefined,
    to_date:   to_date   ?? undefined,
  });
  return response.data;
}

// ─── SCHEME REPORT ────────────────────────────────────────────────────────────

/**
 * Scheme history report — all enrollments, payments, maturity events.
 * @param {{ company_id: number, from_date?: string, to_date?: string }} params
 */
export async function getSchemeHistoryReport({ company_id, from_date, to_date } = {}) {
  const response = await axiosInstance.post(API.REPORTS.SCHEME_HISTORY, {
    company_id,
    from_date: from_date ?? undefined,
    to_date:   to_date   ?? undefined,
  });
  return response.data;
}

// ─── INVOICE REPORT ───────────────────────────────────────────────────────────

/**
 * Invoice report — filterable list of all invoices with amounts.
 * @param {{ company_id: number, from_date?: string, to_date?: string, take?: number, skip?: number }} params
 */
export async function getInvoiceReport({
  company_id,
  from_date,
  to_date,
  take = 100,
  skip = 0,
} = {}) {
  const response = await axiosInstance.post(API.REPORTS.INVOICE_REPORT, {
    company_id,
    from_date: from_date ?? undefined,
    to_date:   to_date   ?? undefined,
    Take:      take,
    Skip:      skip,
  });
  return response.data;
}

// ─── SALES FILTERS ────────────────────────────────────────────────────────────

/**
 * Weekly sales summary.
 * @param {{ company_id: number }} params
 */
export async function getWeeklySales({ company_id }) {
  const response = await axiosInstance.post(API.REPORTS.SALES_WEEKLY, { company_id });
  return response.data;
}

/**
 * Monthly sales summary.
 * @param {{ company_id: number }} params
 */
export async function getMonthlySales({ company_id }) {
  const response = await axiosInstance.post(API.REPORTS.SALES_MONTHLY, { company_id });
  return response.data;
}

/**
 * Quarterly sales summary.
 * @param {{ company_id: number }} params
 */
export async function getQuarterlySales({ company_id }) {
  const response = await axiosInstance.post(API.REPORTS.SALES_QUARTERLY, { company_id });
  return response.data;
}