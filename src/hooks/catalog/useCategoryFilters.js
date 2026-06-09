// src/hooks/catalog/useCategoryFilters.js
// TanStack Query hooks for category filter data (Types, SubTypes, ItemGroups).
// All three datasets are static reference data — cached for STALE_TIME.STATIC (30 min).
// Source of truth: CODING_STANDARDS.md Section 6, API_MAPPING.md Section 4

import { useQuery } from '@tanstack/react-query';
import { getCategories, getSubTypes, getItemGroups } from '@/services/categoryService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

// ── Selector helpers ─────────────────────────────────────────────────────────
// OrnaVerse wraps list responses in Entities / data / result.
// Select normalises to a plain array regardless of wrapper depth.

const selectList = (data) =>
  data?.Entities ?? data?.data ?? data?.result ?? [];

// ── useCategories ────────────────────────────────────────────────────────────

/**
 * Returns all product categories (Types).
 * Cached for 30 minutes — does not re-fetch on every filter interaction.
 *
 * @returns {import('@tanstack/react-query').UseQueryResult}
 * data: Array<{ type_id: number, type_name: string }>
 */
export function useCategories() {
  return useQuery({
    queryKey: QUERY_KEYS.CATEGORIES.TYPES(),
    queryFn: getCategories,
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
    select: selectList,
  });
}

// ── useSubTypes ──────────────────────────────────────────────────────────────

/**
 * Returns all product sub-categories (SubTypes).
 * Includes parent type_id for client-side filtering under a selected category.
 * Cached for 30 minutes.
 *
 * @returns {import('@tanstack/react-query').UseQueryResult}
 * data: Array<{ sub_type_id: number, sub_type_name: string, type_id: number }>
 */
export function useSubTypes() {
  return useQuery({
    queryKey: QUERY_KEYS.CATEGORIES.SUBTYPES(),
    queryFn: getSubTypes,
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
    select: selectList,
  });
}

// ── useItemGroups ────────────────────────────────────────────────────────────

/**
 * Returns all item groups (top-level product classifications).
 * Cached for 30 minutes.
 *
 * @returns {import('@tanstack/react-query').UseQueryResult}
 * data: Array<{ item_group_id: number, item_group_name: string }>
 */
export function useItemGroups() {
  return useQuery({
    queryKey: QUERY_KEYS.CATEGORIES.ITEM_GROUPS(),
    queryFn: getItemGroups,
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
    select: selectList,
  });
}
