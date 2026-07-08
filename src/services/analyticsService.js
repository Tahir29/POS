// src/services/analyticsService.js
// Business intelligence and analytics for store managers.
// All functions are pure HTTP wrappers — no business logic.
//
// Analytics endpoints return aggregated data — not raw transaction lists.
// Use on the Analytics/Dashboard page for KPI widgets and charts.

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

// ─── SALES ANALYTICS ─────────────────────────────────────────────────────────

/**
 * SKU velocity — which items sell fastest.
 * Use for "top sellers" widget and reorder planning.
 * @param {{ company_id: number, from_date: string, to_date: string }} params
 * @returns {Promise<object>} SKU velocity data
 */
export async function getSKUVelocity({ company_id, from_date, to_date }) {
  const response = await axiosInstance.post(API.ANALYTICS.SKU_VELOCITY, {
    company_id,
    from_date,
    to_date,
  });
  return response.data;
}

/**
 * Category-wise sales performance (rings, necklaces, bangles, etc.).
 * @param {{ company_id: number, from_date: string, to_date: string }} params
 * @returns {Promise<object>} Category performance data
 */
export async function getCategoryPerformance({ company_id, from_date, to_date }) {
  const response = await axiosInstance.post(API.ANALYTICS.CATEGORY_PERFORMANCE, {
    company_id,
    from_date,
    to_date,
  });
  return response.data;
}

/**
 * Gross profit analysis by product/category.
 * @param {{ company_id: number, from_date: string, to_date: string }} params
 * @returns {Promise<object>} Gross profit data
 */
export async function getGrossProfit({ company_id, from_date, to_date }) {
  const response = await axiosInstance.post(API.ANALYTICS.GROSS_PROFIT, {
    company_id,
    from_date,
    to_date,
  });
  return response.data;
}

/**
 * Monthly revenue summary — high-level month-by-month revenue.
 * @param {{ company_id: number, Take?: number, Skip?: number }} params
 * @returns {Promise<object>} { Entities: MonthlyRevenueSummaryRow[] }
 */
export async function getMonthlyRevenueSummary({ company_id, Take = 12, Skip = 0 } = {}) {
  const response = await axiosInstance.post(API.ANALYTICS.MONTHLY_REVENUE, {
    company_id,
    Take,
    Skip,
  });
  return response.data;
}

/**
 * Monthly revenue detail — line-level breakdown per month.
 * @param {{ company_id: number, Take?: number, Skip?: number }} params
 * @returns {Promise<object>} { Entities: MonthlyRevenueDetailRow[] }
 */
export async function getMonthlyRevenueDetail({ company_id, Take = 12, Skip = 0 } = {}) {
  const response = await axiosInstance.post(API.ANALYTICS.MONTHLY_REVENUE_DETAIL, {
    company_id,
    Take,
    Skip,
  });
  return response.data;
}

/**
 * Reorder signal — items that are running low and need restocking.
 * @param {{ company_id: number }} params
 * @returns {Promise<object>} Reorder signal data
 */
export async function getReorderSignal({ company_id }) {
  const response = await axiosInstance.post(API.ANALYTICS.REORDER_SIGNAL, {
    company_id,
  });
  return response.data;
}

// ─── POS DASHBOARD ────────────────────────────────────────────────────────────

/**
 * POS dashboard summary — today's sales, top items, receipts.
 * Used on the main dashboard page for the summary widget.
 * @param {{ company_id: number, from_date?: string, to_date?: string }} params
 * @returns {Promise<object>} POS dashboard data
 */
export async function getPOSDashboard({ company_id, from_date, to_date } = {}) {
  const response = await axiosInstance.post(API.ANALYTICS.POS_DASHBOARD, {
    company_id,
    from_date: from_date ?? undefined,
    to_date:   to_date   ?? undefined,
  });
  return response.data;
}

// ─── AI ANALYTICS ─────────────────────────────────────────────────────────────

/**
 * Ask the AI analytics engine a business question in natural language.
 * @param {{ question: string, company_id: number }} params
 * @returns {Promise<object>} AI response with answer and data
 */
export async function askAIAnalytics({ question, company_id }) {
  const response = await axiosInstance.post(API.ANALYTICS.AI_ASK, {
    question,
    company_id,
  });
  return response.data;
}

/**
 * Get AI-generated business insights for the store.
 * @param {{ company_id: number, from_date?: string, to_date?: string }} params
 * @returns {Promise<object>} AI insights response
 */
export async function getAIInsights({ company_id, from_date, to_date } = {}) {
  const response = await axiosInstance.post(API.ANALYTICS.AI_INSIGHTS, {
    company_id,
    from_date: from_date ?? undefined,
    to_date:   to_date   ?? undefined,
  });
  return response.data;
}