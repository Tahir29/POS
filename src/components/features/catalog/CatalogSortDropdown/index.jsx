// src/components/features/catalog/CatalogSortDropdown/index.jsx
// Sort control for the catalog page.
// Matches the "Sort By" pill design from the target UI.

'use client';

import { SlidersHorizontal, ChevronDown } from 'lucide-react';

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
    SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Sort By';

  const isDefault = !sortBy || sortBy === DEFAULT_SORT;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={[
            'flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            isDefault
              ? 'border-border bg-white text-foreground hover:bg-stone-50'
              : 'border-primary bg-primary text-white hover:bg-primary/90',
          ].join(' ')}
        >
          <SlidersHorizontal size={15} className="shrink-0" />
          <span>{isDefault ? 'Sort By' : activeLabel}</span>
          <ChevronDown size={14} className="shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        {SORT_OPTIONS.map((opt) => {
          const isActive = sortBy === opt.value;
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