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
// Returns derived data ready for CustomizeSheet:
//   variants          — raw style_variants array
//   externalProductId — Shopify product ID (Entity.external_product_id)
//                       used by useShopifyProductImages; null on UAT
//   metalColors       — unique metal colour options  [{ id, name }]
//   karats            — unique karat options          [{ id, name }]
//   sizes             — unique size options           [{ id, name }]
//   variantStock      — Map<item_id, pieces>  (for in-stock dots)
//   findVariant       — (metalColorId, karatId, sizeId) => variant | null
//   hasVariants       — boolean

import { useQuery } from '@tanstack/react-query';
import { useMemo }  from 'react';
import { getDesignVariants } from '@/services/itemService';
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

export function useDesignVariants(styleId) {
  const { data, isLoading, isError } = useQuery({
    queryKey:  QUERY_KEYS.ITEMS.DESIGN_VARIANTS(styleId),
    queryFn:   () => getDesignVariants(styleId),
    enabled:   !!styleId,
    staleTime: APP_CONFIG.STALE_TIME.CATALOG,
    select:    selectStyleData,
  });

  const variants = data?.variants ?? [];
  const externalProductId = data?.externalProductId ?? null;

  // Unique metal colour options — filter out NA values
  const metalColors = useMemo(() =>
    unique(
      variants.filter((v) => isValid(v.metal_color_name) && v.metal_color_id != null),
      (v) => v.metal_color_id,
    ).map((v) => ({ id: v.metal_color_id, name: v.metal_color_name })),
  [variants]);

  // Unique karat options — filter out NA values
  const karats = useMemo(() =>
    unique(
      variants.filter((v) => isValid(v.karat_name) && v.karat_id != null),
      (v) => v.karat_id,
    ).map((v) => ({ id: v.karat_id, name: v.karat_name })),
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

  // Map of item_id → pieces for in-stock dot indicators.
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