// Real, live cross-store stock + store CODES for a set of items — the short
// "BO1"/"N18"-style codes ProductCard's stock badge shows. Cross-referenced
// from availableStores (GetUserStores, already in Redux at login) because
// GetStockByStores/GetStockByStoresBatch only ever return company_id plus
// the long `companyname` (e.g. "BO1-Sky City Borivali CoCo Store") — never a
// short code — confirmed live 2026-08-26.
//
// Exists because ProductCard's stock badge, outside the main catalog grid,
// had nothing real to show:
//   - Recently Viewed: has_stock is a SNAPSHOT taken at whatever store was
//     active when the product was viewed (see useRecordProductView) — stale
//     the moment the operator switches stores or comes back later.
//   - Wishlist: has_stock is never set at all anywhere in the wishlist write
//     path (Mongo doc has no such field), so it was always falling through
//     to "Made to Order".
// Both cases then labeled whatever they DID show with the CURRENTLY active
// store's code regardless of whether that store — or any store — is what's
// actually being shown. That's the exact reported bug: a store code "not
// wired properly ... not just the store the user is logged into". This
// hook replaces the guess with the genuine per-item, cross-store answer.
//
// item_id already encodes the specific variant/customization in this ERP
// model (size, metal color, etc. are baked into a distinct item_id, not a
// separate filter — see useDesignVariants.js's own header), so checking
// stock by item_id is naturally scoped to "the same customization" already,
// no extra matching needed.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getStockByStoresBatch } from '@/services/catalogService';
import { selectAvailableStores } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {(number|null|undefined)[]} itemIds
 * @returns {{
 *   stockByItemId: Map<number, { hasStock: boolean, storeCodes: string[] }>,
 *   isLoading: boolean,
 * }}
 *   A requested item_id only resolves once isLoading is false — check that
 *   before treating a missing map entry as "confirmed nowhere in stock"
 *   rather than "haven't checked yet".
 */
export function useCrossStoreStockCodes(itemIds) {
  const availableStores = useSelector(selectAvailableStores);
  const codeByCompanyId = useMemo(
    () => new Map(availableStores.map((s) => [s.company_id, s.company_code])),
    [availableStores]
  );

  const ids = useMemo(
    () => [...new Set((itemIds ?? []).filter((id) => id != null))],
    [itemIds]
  );

  const query = useQuery({
    queryKey:  QUERY_KEYS.CATALOG.STOCK_BY_STORES_BATCH(ids),
    queryFn:   async () => (await getStockByStoresBatch(ids))?.Entities ?? [],
    enabled:   ids.length > 0,
    staleTime: APP_CONFIG.STALE_TIME.STOCK,
  });

  const stockByItemId = useMemo(() => {
    const codesByItemId = new Map();
    for (const row of query.data ?? []) {
      if (!(row.pieces > 0)) continue;
      const code = codeByCompanyId.get(row.company_id);
      if (!code) continue; // a store this signed-in user has no access to — nothing useful to show
      if (!codesByItemId.has(row.item_id)) codesByItemId.set(row.item_id, new Set());
      codesByItemId.get(row.item_id).add(code);
    }

    const result = new Map();
    codesByItemId.forEach((codes, itemId) => {
      result.set(itemId, { hasStock: true, storeCodes: [...codes] });
    });
    // Every requested id resolves to a real (possibly empty) verdict once
    // the query has actually answered — never left "missing" just because
    // it happened to have zero in-stock rows.
    if (!query.isLoading) {
      for (const id of ids) {
        if (!result.has(id)) result.set(id, { hasStock: false, storeCodes: [] });
      }
    }
    return result;
  }, [query.data, query.isLoading, codeByCompanyId, ids]);

  return { stockByItemId, isLoading: query.isLoading };
}
