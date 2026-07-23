'use client';

// src/components/shared/LineItemCard/index.jsx
//
// Shared repeatable line-item card chrome for the useFieldArray-driven
// "New" forms on returns/exchange/buyback/urd-purchase — the index label,
// card shell, and conditional remove button were hand-rolled identically
// across all 4 (only p-3 vs p-4 padding drifted). Owns only the chrome;
// the actual field inputs stay page-owned via children, since each page's
// field shape genuinely differs (returns has no metal/weight concept,
// urd-purchase has no item_name/gross_weight).

import RemoveLineItemButton from '@/components/shared/RemoveLineItemButton';

export default function LineItemCard({ index, itemLabel = 'Item', showRemove, onRemove, children }) {
  return (
    <div className="rounded-xl border border-border bg-muted p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{itemLabel} {index + 1}</span>
        {showRemove && <RemoveLineItemButton onClick={onRemove} />}
      </div>
      {children}
    </div>
  );
}
