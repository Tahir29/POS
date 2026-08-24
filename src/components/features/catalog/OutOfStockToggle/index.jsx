'use client';

// Labeled toggle switch — shows/hides out-of-stock products.
// Restyled to a plain label + switch (no icon/pill/border) to match
// the new design's minimal treatment.

import { Switch } from '@/components/ui/switch';

export default function OutOfStockToggle({ showOutOfStock, onToggle }) {
  return (
    <label className="flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 sm:w-auto sm:justify-start sm:shrink-0">
      <span className="text-sm font-medium text-foreground whitespace-nowrap">
        Show Out of Stock
      </span>
      <Switch checked={showOutOfStock} onCheckedChange={onToggle} />
    </label>
  );
}
