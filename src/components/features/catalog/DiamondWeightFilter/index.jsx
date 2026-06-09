'use client';

import WeightRangeFilter from '@/components/features/catalog/WeightRangeFilter';

/**
 * DiamondWeightFilter
 * Thin wrapper around WeightRangeFilter with the diamond-specific label.
 * Keeps DiamondWeightFilter as a named, discoverable component per the spec.
 *
 * Props:
 *   fromValue    — number | null
 *   toValue      — number | null
 *   onApply(from, to) — callback
 */
export default function DiamondWeightFilter({ fromValue, toValue, onApply }) {
  return (
    <WeightRangeFilter
      label="Diamond Weight (ct)"
      fromValue={fromValue}
      toValue={toValue}
      onApply={onApply}
    />
  );
}