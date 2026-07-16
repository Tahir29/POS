// src/hooks/products/useDesignVariants.js
//
// Fetches all style variants for a product via Style/Retrieve (GetDesignDetail).
// Enabled only when product has a style_id.
//
// OrnaVerse Style/Retrieve response shape:
//   response.data.Entity.style_variants[]
//   Each variant: { item_id, item_code, item_name, karat_id, karat_name,
//                   metal_color_id, metal_color_name, item_size_id,
//                   item_size_name, pieces, ... }
//
// IMPORTANT — style_variants[].pieces is NOT scoped to the active store.
// Confirmed 2026-07-15: Style/Retrieve reported pieces:1 for every single
// one of 36 variants on a real product, but the real per-store check
// (ProductCatalog/GetStockByStoresBatch) showed only 1 of those 36 was
// actually stocked at the store in question — the other 35 aren't
// physically here at all. Using the raw field would show a false green
// "in stock" dot on every customize option regardless of real
// availability, so this hook fetches real per-store stock separately and
// patches it onto each variant before anything downstream sees it.
//
// Returns derived data ready for CustomizeSheet:
//   variants          — style_variants array, with `pieces` corrected to
//                        real per-store stock
//   externalProductId — Shopify product ID (Entity.external_product_id)
//                       used by useShopifyProductImages; null on UAT
//   metalColors       — unique metal colour options  [{ id, name }]
//   karats            — unique karat options          [{ id, name }]
//   sizes             — unique size options           [{ id, name }]
//   variantStock      — Map<item_id, pieces>  (for in-stock dots) — real
//                        per-store counts
//   findVariant       — (metalColorId, karatId, sizeId) => variant | null
//   hasVariants       — boolean

import { useQuery } from '@tanstack/react-query';
import { useMemo }  from 'react';
import { getDesignVariants }    from '@/services/itemService';
import { getStockByStoresBatch } from '@/services/catalogService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG    from '@/constants/appConfig';

function unique(arr, keyFn) {
  const seen = new Set();
  return arr.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Robust select with multiple fallback levels.
// Style/Retrieve returns Entity (singular), not Entities.
// Guard every level so a malformed response returns safe defaults.
//
// Also extracts external_product_id from Entity — used by
// useShopifyProductImages to fetch images from Shopify Admin API.
// When OrnaVerse starts serving images natively, remove the Shopify hook
// call in the product detail page; this field can stay or be removed then.
function selectStyleData(response) {
  // Primary path: response.data.Entity
  const entity = response?.data?.Entity;
  if (entity?.style_variants && Array.isArray(entity.style_variants)) {
    return {
      variants:          entity.style_variants,
      externalProductId: entity.external_product_id ?? null,
    };
  }
  // Fallback 1: response.data.Entities[0] (list shape)
  const firstEntity = response?.data?.Entities?.[0];
  if (firstEntity?.style_variants && Array.isArray(firstEntity.style_variants)) {
    return {
      variants:          firstEntity.style_variants,
      externalProductId: firstEntity.external_product_id ?? null,
    };
  }
  // Fallback 2: response.data.style_variants (flat)
  const flat = response?.data?.style_variants;
  if (Array.isArray(flat)) {
    return { variants: flat, externalProductId: null };
  }
  // Nothing found
  return { variants: [], externalProductId: null };
}

const NA_VALUES = new Set(['NA', 'N/A', 'na', '', null, undefined]);
function isValid(value) {
  return !NA_VALUES.has(value);
}

/**
 * @param {number|null} styleId
 * @param {number|null} storeId — active store, used to scope real stock
 *   (see the module note above for why the raw style_variants pieces field
 *   can't be trusted on its own).
 */
export function useDesignVariants(styleId, storeId) {
  const { data, isLoading: designLoading, isError } = useQuery({
    queryKey:  QUERY_KEYS.ITEMS.DESIGN_VARIANTS(styleId),
    queryFn:   () => getDesignVariants(styleId),
    enabled:   !!styleId,
    staleTime: APP_CONFIG.STALE_TIME.CATALOG,
    select:    selectStyleData,
  });

  // FIX: `data?.variants ?? []` used to be computed inline below, which
  // creates a brand-new [] array identity on every render whenever
  // data?.variants is falsy — that defeated the point of the useMemo calls
  // further down (their [variants] dep would "change" every render even
  // with no real data change). Memoizing variants itself once fixes it.
  const rawVariants = useMemo(() => data?.variants ?? [], [data]);

  const externalProductId = data?.externalProductId ?? null;

  const itemIds = useMemo(
    () => rawVariants.map((v) => v.item_id).filter((id) => id != null),
    [rawVariants],
  );

  // Real per-store stock — see module note. Only enabled once we know
  // which items to check and which store to check them at.
  const { data: stockByItemId = new Map(), isLoading: stockLoading } = useQuery({
    queryKey: QUERY_KEYS.CATALOG.STOCK_BY_STORES_BATCH(itemIds),
    queryFn: async () => {
      const stockData = await getStockByStoresBatch(itemIds);
      const rows = stockData?.Entities ?? [];
      return new Map(
        rows
          .filter((row) => row.company_id === storeId)
          .map((row) => [row.item_id, row.pieces ?? 0])
      );
    },
    enabled:   itemIds.length > 0 && !!storeId,
    staleTime: APP_CONFIG.STALE_TIME.STOCK,
  });

  // Patch each variant's `pieces` with the real per-store count (0 when
  // this store has no stock row for it — i.e. not physically here) so
  // every downstream consumer (combo/size dots, the matched-variant
  // summary card, MTO detection) reflects real availability instead of
  // the misleading style-level field.
  const variants = useMemo(
    () => rawVariants.map((v) => ({
      ...v,
      pieces: stockByItemId.get(v.item_id) ?? 0,
    })),
    [rawVariants, stockByItemId],
  );

  const isLoading = designLoading || (itemIds.length > 0 && stockLoading);

  // Unique metal colour options — filter out NA values
  const metalColors = useMemo(() =>
    unique(
      variants.filter((v) => isValid(v.metal_color_name) && v.metal_color_id != null),
      (v) => v.metal_color_id,
    ).map((v) => ({ id: v.metal_color_id, name: v.metal_color_name })),
  [variants]);

  // Unique karat options — filter out NA values, sorted numerically (14KT
  // before 18KT) rather than relying on incidental API response order.
  const karats = useMemo(() =>
    unique(
      variants.filter((v) => isValid(v.karat_name) && v.karat_id != null),
      (v) => v.karat_id,
    )
    .map((v) => ({ id: v.karat_id, name: v.karat_name }))
    .sort((a, b) => parseFloat(a.name) - parseFloat(b.name)),
  [variants]);

  // Unique size options — sorted numerically
  const sizes = useMemo(() =>
    unique(
      variants.filter((v) => v.item_size_id != null && isValid(v.item_size_name)),
      (v) => v.item_size_id,
    )
    .map((v) => ({ id: v.item_size_id, name: v.item_size_name }))
    .sort((a, b) => parseFloat(a.name) - parseFloat(b.name)),
  [variants]);

  // Map of item_id → pieces (real per-store count) for in-stock dot indicators.
  // pieces > 0 means in stock.
  const variantStock = useMemo(() => {
    const map = new Map();
    for (const v of variants) {
      if (v.item_id != null) {
        map.set(v.item_id, v.pieces ?? 0);
      }
    }
    return map;
  }, [variants]);

  // Find the exact variant matching the three selections.
  // null selector means "any" — used when a section has no options.
  const findVariant = (metalColorId, karatId, sizeId) => {
    return variants.find((v) => {
      const matchMetal = metalColorId == null || v.metal_color_id === metalColorId;
      const matchKarat = karatId      == null || v.karat_id       === karatId;
      const matchSize  = sizeId       == null || v.item_size_id   === sizeId;
      return matchMetal && matchKarat && matchSize;
    }) ?? null;
  };

  return {
    variants,
    externalProductId,  // Shopify product ID — null on UAT, real ID on LIVE
    metalColors,
    karats,
    sizes,
    variantStock,
    findVariant,
    isLoading,
    isError,
    hasVariants: variants.length > 0,
  };
}
