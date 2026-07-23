'use client';

// src/components/features/catalog/OutOfStockToggle/index.jsx
// Labeled toggle switch — shows/hides out-of-stock products.
// Restyled to a plain label + switch (no icon/pill/border) to match
// the new design's minimal treatment.

import { Switch } from '@/components/ui/switch';

export default function OutOfStockToggle({ showOutOfStock, onToggle }) {
  return (
    <label className="flex items-center gap-2 shrink-0 min-h-[44px] px-2 rounded-lg">
      <span className="hidden sm:inline text-sm text-muted-foreground whitespace-nowrap">
        Show Out of Stock
      </span>
      <Switch checked={showOutOfStock} onCheckedChange={onToggle} />
    </label>
  );
}
