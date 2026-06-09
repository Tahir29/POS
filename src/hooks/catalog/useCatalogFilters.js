// src/hooks/catalog/useCatalogFilters.js
// Manages all catalog filter state and keeps it in sync with URL query params.
// URL is the single source of truth — reading params on mount restores state after refresh.
//
// URL param keys (short to keep URLs clean):
//   group  — item_group_id (number)
//   cat    — type_id (number)
//   sub    — sub_type_id (number)
//   oos    — show_out_of_stock ("1" = true, absent = false)
//   q      — search query string
//   skip   — pagination offset (number, default 0)
//   fw     — from_weight (float)
//   tw     — to_weight (float)
//   fdw    — from_diamond_weight (float)
//   tdw    — to_diamond_weight (float)
//
// Source of truth: DEVELOPMENT_PHASES.md Phase 5 & Phase 6 acceptance criteria

'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import APP_CONFIG from '@/constants/appConfig';

// ── URL param helpers ─────────────────────────────────────────────────────────

const PARAM = {
  GROUP: 'group',
  CAT:   'cat',
  SUB:   'sub',
  OOS:   'oos',
  Q:     'q',
  SKIP:  'skip',
  FW:    'fw',
  TW:    'tw',
  FDW:   'fdw',
  TDW:   'tdw',
};

function parseId(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function parseFloat_(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function buildParams(current, updates) {
  // Merge updates onto a copy of current URLSearchParams.
  // A null/undefined/empty value removes the key entirely (clean URLs).
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === '' || value === false) {
      next.delete(key);
    } else {
      next.set(key, String(value));
    }
  }
  return next;
}

// ── useCatalogFilters ─────────────────────────────────────────────────────────

/**
 * Returns current filter state (derived from URL) and setter actions.
 * All setters update the URL via router.push — no local state needed.
 *
 * Returned shape:
 * {
 *   filters: {
 *     activeGroupId:      number | null,
 *     activeCategoryId:   number | null,
 *     activeSubTypeId:    number | null,
 *     showOos:            boolean,
 *     searchQuery:        string,
 *     skip:               number,
 *     fromWeight:         number | null,
 *     toWeight:           number | null,
 *     fromDiamondWeight:  number | null,
 *     toDiamondWeight:    number | null,
 *     // API-ready arrays for useCatalogProducts:
 *     item_group_ids:     number[],
 *     type_ids:           number[],
 *     sub_type_ids:       number[],
 *     show_out_of_stock:  boolean,
 *     Skip:               number,
 *   },
 *   hasActiveFilters: boolean,
 *   actions: {
 *     selectGroup:          (id: number | null) => void,
 *     selectCategory:       (id: number | null) => void,
 *     selectSubType:        (id: number | null) => void,
 *     toggleOos:            () => void,
 *     setSearch:            (q: string) => void,
 *     loadMore:             () => void,
 *     clearFilters:         () => void,
 *     setWeightRange:       (from: number | null, to: number | null) => void,
 *     setDiamondWeightRange:(from: number | null, to: number | null) => void,
 *   }
 * }
 */
export function useCatalogFilters() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  // ── Read current state from URL ─────────────────────────────────────────

  const activeGroupId    = parseId(searchParams.get(PARAM.GROUP));
  const activeCategoryId = parseId(searchParams.get(PARAM.CAT));
  const activeSubTypeId  = parseId(searchParams.get(PARAM.SUB));
  const showOos          = searchParams.get(PARAM.OOS) === '1';
  const searchQuery      = searchParams.get(PARAM.Q) ?? '';
  const skip             = parseId(searchParams.get(PARAM.SKIP)) ?? 0;

  // Weight range params (Phase 6 — advanced filters)
  const fromWeight        = parseFloat_(searchParams.get(PARAM.FW));
  const toWeight          = parseFloat_(searchParams.get(PARAM.TW));
  const fromDiamondWeight = parseFloat_(searchParams.get(PARAM.FDW));
  const toDiamondWeight   = parseFloat_(searchParams.get(PARAM.TDW));

  // ── hasActiveFilters — includes weight fields ───────────────────────────

  const hasActiveFilters =
    activeGroupId !== null ||
    activeCategoryId !== null ||
    activeSubTypeId !== null ||
    showOos ||
    searchQuery !== '' ||
    fromWeight !== null ||
    toWeight !== null ||
    fromDiamondWeight !== null ||
    toDiamondWeight !== null;

  // ── API-ready filter object for useCatalogProducts ──────────────────────

  const filters = useMemo(() => ({
    activeGroupId,
    activeCategoryId,
    activeSubTypeId,
    showOos,
    searchQuery,
    skip,
    // Weight ranges
    fromWeight,
    toWeight,
    fromDiamondWeight,
    toDiamondWeight,
    // API param names:
    ...(activeGroupId    !== null && { item_group_ids: [activeGroupId] }),
    ...(activeCategoryId !== null && { type_ids:       [activeCategoryId] }),
    ...(activeSubTypeId  !== null && { sub_type_ids:   [activeSubTypeId] }),
    show_out_of_stock: showOos,
    Skip: skip,
  }), [
    activeGroupId,
    activeCategoryId,
    activeSubTypeId,
    showOos,
    searchQuery,
    skip,
    fromWeight,
    toWeight,
    fromDiamondWeight,
    toDiamondWeight,
  ]);

  // ── URL push helper ─────────────────────────────────────────────────────

  const push = useCallback(
    (updates) => {
      const next = buildParams(searchParams, updates);
      const qs = next.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  // ── Actions ─────────────────────────────────────────────────────────────

  const selectGroup = useCallback(
    (id) => {
      // Changing group resets category, sub-type, and pagination
      push({
        [PARAM.GROUP]: id,
        [PARAM.CAT]:   null,
        [PARAM.SUB]:   null,
        [PARAM.SKIP]:  null,
      });
    },
    [push],
  );

  const selectCategory = useCallback(
    (id) => {
      // Changing category resets sub-type and pagination
      push({
        [PARAM.CAT]:  id,
        [PARAM.SUB]:  null,
        [PARAM.SKIP]: null,
      });
    },
    [push],
  );

  const selectSubType = useCallback(
    (id) => {
      push({ [PARAM.SUB]: id, [PARAM.SKIP]: null });
    },
    [push],
  );

  const toggleOos = useCallback(() => {
    push({ [PARAM.OOS]: showOos ? null : '1', [PARAM.SKIP]: null });
  }, [push, showOos]);

  const setSearch = useCallback(
    (q) => {
      // Only fire URL update when query meets minimum length or is being cleared
      if (q.length > 0 && q.length < APP_CONFIG.SEARCH.MIN_QUERY_LENGTH) return;
      push({ [PARAM.Q]: q || null, [PARAM.SKIP]: null });
    },
    [push],
  );

  const loadMore = useCallback(() => {
    push({ [PARAM.SKIP]: skip + APP_CONFIG.PAGINATION.CATALOG_TAKE });
  }, [push, skip]);

  const clearFilters = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  // Weight range setters use the shared push helper so they stay consistent
  // with the rest of the URL-based filter pattern.
  const setWeightRange = useCallback(
    (from, to) => {
      push({
        [PARAM.FW]:   from ?? null,
        [PARAM.TW]:   to ?? null,
        [PARAM.SKIP]: null,
      });
    },
    [push],
  );

  const setDiamondWeightRange = useCallback(
    (from, to) => {
      push({
        [PARAM.FDW]:  from ?? null,
        [PARAM.TDW]:  to ?? null,
        [PARAM.SKIP]: null,
      });
    },
    [push],
  );

  // ── Return ───────────────────────────────────────────────────────────────

  return {
    filters,
    hasActiveFilters,
    actions: {
      selectGroup,
      selectCategory,
      selectSubType,
      toggleOos,
      setSearch,
      loadMore,
      clearFilters,
      setWeightRange,
      setDiamondWeightRange,
    },
  };
}