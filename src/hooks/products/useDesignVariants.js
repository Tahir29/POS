// Fetches all style variants for a product via Style/Retrieve (GetDesignDetail),
// and patches in real per-store stock (style_variants[].pieces is not scoped
// to the active store — see fetch below). Enabled only when product has a
// style_id. Returns derived data ready for CustomizeSheet: variants, the
// Shopify externalProductId, unique metalColors/karats/sizes, variantStock
// and storesByItemId maps, findVariant, and hasVariants.

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

// Style/Retrieve returns Entity (singular), not Entities; guard every level
// so a malformed response returns safe defaults. Also extracts
// external_product_id, used by useShopifyProductImages to fetch images from
// the Shopify Admin API.
function selectStyleData(response) {
  const entity = response?.data?.Entity;
  if (entity?.style_variants && Array.isArray(entity.style_variants)) {
    return {
      variants:          entity.style_variants,
      externalProductId: entity.external_product_id ?? null,
    };
  }
  const firstEntity = response?.data?.Entities?.[0];
  if (firstEntity?.style_variants && Array.isArray(firstEntity.style_variants)) {
    return {
      variants:          firstEntity.style_variants,
      externalProductId: firstEntity.external_product_id ?? null,
    };
  }
  const flat = response?.data?.style_variants;
  if (Array.isArray(flat)) {
    return { variants: flat, externalProductId: null };
  }
  return { variants: [], externalProductId: null };
}

const NA_VALUES = new Set(['NA', 'N/A', 'na', '', null, undefined]);
function isValid(value) {
  return !NA_VALUES.has(value);
}

/**
 * @param {number|null} styleId
 * @param {number|null} storeId — active store, used to scope real stock
 */
export function useDesignVariants(styleId, storeId) {
  const { data, isLoading: designLoading, isError } = useQuery({
    queryKey:  QUERY_KEYS.ITEMS.DESIGN_VARIANTS(styleId),
    queryFn:   () => getDesignVariants(styleId),
    enabled:   !!styleId,
    staleTime: APP_CONFIG.STALE_TIME.CATALOG,
    select:    selectStyleData,
  });

  // Memoized so a falsy data?.variants doesn't create a new [] identity every
  // render (which would defeat the useMemo calls further down).
  const rawVariants = useMemo(() => data?.variants ?? [], [data]);

  const externalProductId = data?.externalProductId ?? null;

  const itemIds = useMemo(
    () => rawVariants.map((v) => v.item_id).filter((id) => id != null),
    [rawVariants],
  );

  // Real per-store stock, enabled once we know which items/store to check.
  // Keeps the full row set (every store) so storesByItemId below can show
  // cross-store availability without a second call.
  const { data: stockRows = [], isLoading: stockLoading } = useQuery({
    queryKey: QUERY_KEYS.CATALOG.STOCK_BY_STORES_BATCH(itemIds),
    queryFn: async () => {
      const stockData = await getStockByStoresBatch(itemIds);
      return stockData?.Entities ?? [];
    },
    enabled:   itemIds.length > 0 && !!storeId,
    staleTime: APP_CONFIG.STALE_TIME.STOCK,
  });

  const stockByItemId = useMemo(() => {
    const map = new Map();
    for (const row of stockRows) {
      if (row.company_id === storeId) map.set(row.item_id, row.pieces ?? 0);
    }
    return map;
  }, [stockRows, storeId]);

  // Cross-store breakdown per variant, for CustomizeSheet's "in stock at X".
  const storesByItemId = useMemo(() => {
    const map = new Map();
    for (const row of stockRows) {
      if (row.item_id == null) continue;
      const list = map.get(row.item_id) ?? [];
      list.push({
        company_id:  row.company_id,
        companyname: row.companyname,
        pieces:      row.pieces ?? 0,
      });
      map.set(row.item_id, list);
    }
    return map;
  }, [stockRows]);

  // Patch each variant's `pieces` with the real per-store count (0 if this
  // store has no stock row for it) so downstream consumers reflect real
  // availability instead of the misleading style-level field.
  const variants = useMemo(
    () => rawVariants.map((v) => ({
      ...v,
      pieces: stockByItemId.get(v.item_id) ?? 0,
    })),
    [rawVariants, stockByItemId],
  );

  const isLoading = designLoading || (itemIds.length > 0 && stockLoading);

  const metalColors = useMemo(() =>
    unique(
      variants.filter((v) => isValid(v.metal_color_name) && v.metal_color_id != null),
      (v) => v.metal_color_id,
    ).map((v) => ({ id: v.metal_color_id, name: v.metal_color_name })),
  [variants]);

  // Sorted numerically (14KT before 18KT) rather than API response order.
  const karats = useMemo(() =>
    unique(
      variants.filter((v) => isValid(v.karat_name) && v.karat_id != null),
      (v) => v.karat_id,
    )
    .map((v) => ({ id: v.karat_id, name: v.karat_name }))
    .sort((a, b) => parseFloat(a.name) - parseFloat(b.name)),
  [variants]);

  const sizes = useMemo(() =>
    unique(
      variants.filter((v) => v.item_size_id != null && isValid(v.item_size_name)),
      (v) => v.item_size_id,
    )
    .map((v) => ({ id: v.item_size_id, name: v.item_size_name }))
    .sort((a, b) => parseFloat(a.name) - parseFloat(b.name)),
  [variants]);

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
    storesByItemId,
    findVariant,
    isLoading,
    isError,
    hasVariants: variants.length > 0,
  };
}
