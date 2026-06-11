// src/hooks/products/useDesignVariants.js
//
// Fetches all style variants for a product via GetDesigns.
// Enabled only when product has a style_id.
//
// Response shape: response.data.Entities[0].style_variants[]
// Each variant: { item_id, karat_id, karat_name, metal_color_id,
//                 metal_color_name, item_size_id, item_size_name, ... }
//
// Returns derived data ready for the CustomizeSheet:
//   variants     — raw style_variants array
//   metalColors  — unique metal color options
//   karats       — unique karat options
//   sizes        — unique size options
//   findVariant  — function to find a variant by selections

import { useQuery }  from '@tanstack/react-query';
import { useMemo }   from 'react';
import { getDesignVariants } from '@/services/itemService';
import APP_CONFIG    from '@/constants/appConfig';

const QUERY_KEY = (styleId) => ['design-variants', styleId];

function unique(arr, keyFn) {
  const seen = new Set();
  return arr.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function useDesignVariants(styleId) {
  const { data: rawData, isLoading, isError } = useQuery({
    queryKey: QUERY_KEY(styleId),
    queryFn:  () => getDesignVariants(styleId),
    enabled: !!styleId,
    staleTime: APP_CONFIG.STALE_TIME.CATALOG,
    // response.data.Entities[0].style_variants
    select: (response) => {
      const entity = response?.data?.Entity ?? response?.data ?? {};
      return entity?.style_variants ?? [];
    },
  });

  const variants = rawData ?? [];

  // Derive unique selectable options from variants
  const metalColors = useMemo(() =>
    unique(
      variants.filter((v) => v.metal_color_name && v.metal_color_name !== 'NA'),
      (v) => v.metal_color_id
    ).map((v) => ({
      id:   v.metal_color_id,
      name: v.metal_color_name,
    })),
  [variants]);

  const karats = useMemo(() =>
    unique(
      variants.filter((v) => v.karat_name && v.karat_name !== 'NA'),
      (v) => v.karat_id
    ).map((v) => ({
      id:   v.karat_id,
      name: v.karat_name,
    })),
  [variants]);

  const sizes = useMemo(() =>
    unique(
      variants.filter((v) => v.item_size_name && v.item_size_id),
      (v) => v.item_size_id
    ).map((v) => ({
      id:   v.item_size_id,
      name: v.item_size_name,
    })).sort((a, b) => parseFloat(a.name) - parseFloat(b.name)),
  [variants]);

  // Find the exact variant matching selected options
  const findVariant = (metalColorId, karatId, sizeId) => {
    return variants.find((v) => {
      const matchMetal = !metalColorId || v.metal_color_id === metalColorId;
      const matchKarat = !karatId      || v.karat_id       === karatId;
      const matchSize  = !sizeId       || v.item_size_id   === sizeId;
      return matchMetal && matchKarat && matchSize;
    }) ?? null;
  };

  return {
    variants,
    metalColors,
    karats,
    sizes,
    findVariant,
    isLoading,
    isError,
    hasVariants: variants.length > 0,
  };
}
