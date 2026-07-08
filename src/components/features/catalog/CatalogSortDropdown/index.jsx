// src/components/features/catalog/CatalogSortDropdown/index.jsx
// Sort control for the catalog page.
// Always shows "Sort by: {current label}" — including the default —
// since "Name A→Z" (the real default) is meaningful, unlike a placeholder.

'use client';

import { ArrowUpDown, ChevronDown } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { SORT_OPTIONS, DEFAULT_SORT } from '@/hooks/catalog/useCatalogFilters';

/**
 * @param {object}   props
 * @param {string}   props.sortBy      - Current sort value
 * @param {function} props.onSortChange - Called with new sort value string
 */
export default function CatalogSortDropdown({ sortBy, onSortChange }) {
  const activeLabel =
    SORT_OPTIONS.find((o) => o.value === (sortBy || DEFAULT_SORT))?.label ?? 'Name A→Z';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={[
            'flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-foreground',
            'hover:bg-stone-50 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          ].join(' ')}
        >
          <ArrowUpDown size={14} className="shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">Sort by:</span>
          <span>{activeLabel}</span>
          <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        {SORT_OPTIONS.map((opt) => {
          const isActive = (sortBy || DEFAULT_SORT) === opt.value;
          return (
            <DropdownMenuItem
              key={opt.value}
              onSelect={() => onSortChange(opt.value)}
              className={isActive ? 'font-semibold text-primary' : ''}
            >
              {opt.label}
              {isActive && (
                <span className="ml-auto text-xs text-primary">✓</span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
