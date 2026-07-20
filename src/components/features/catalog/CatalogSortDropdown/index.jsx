// src/components/features/catalog/CatalogSortDropdown/index.jsx
// Sort control for the catalog page.
// Always shows "Sort by: {current label}" — including the default —
// since "Name A→Z" (the real default) is meaningful, unlike a placeholder.

'use client';

import { ArrowUpDown } from 'lucide-react';

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

import { SORT_OPTIONS, DEFAULT_SORT } from '@/hooks/catalog/useCatalogFilters';

/**
 * @param {object}   props
 * @param {string}   props.sortBy      - Current sort value
 * @param {function} props.onSortChange - Called with new sort value string
 */
export default function CatalogSortDropdown({ sortBy, onSortChange }) {
  return (
    <Select value={sortBy || DEFAULT_SORT} onValueChange={onSortChange}>
      <SelectTrigger className="gap-2 rounded-lg border-border bg-white px-4 py-2 text-sm font-medium text-foreground hover:bg-stone-50">
        <ArrowUpDown size={14} className="shrink-0 text-muted-foreground" />
        <span className="text-muted-foreground">Sort by:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" className="w-44">
        {SORT_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
