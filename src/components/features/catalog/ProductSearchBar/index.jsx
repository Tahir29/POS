'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import APP_CONFIG from '@/constants/appConfig';

const { SEARCH } = APP_CONFIG;

/**
 * ProductSearchBar
 * Debounced search input wired to URL via the `onSearch` callback.
 * Fires onSearch after DEBOUNCE_MS when input >= MIN_QUERY_LENGTH, or
 * immediately when cleared (empty string).
 *
 * Props:
 *   value              — string  — controlled value from URL (filters.searchQuery)
 *   onSearch(q)        — fires debounced query string up to parent
 *   onAdvancedOpen()   — opens the AdvancedFilterPanel
 *   hasAdvancedActive  — boolean — lights up the filter button badge
 *   recentSearches     — string[]
 *   onRecentSelect(q)  — callback when a recent search chip is tapped
 */
export default function ProductSearchBar({
  value,
  onSearch,
  onAdvancedOpen,
  hasAdvancedActive = false,
  recentSearches = [],
  onRecentSelect,
}) {
  // Internal buffer so we can debounce without the URL flickering on every keystroke
  const [inputVal, setInputVal] = useState(value ?? '');
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  // Keep local buffer in sync when URL is cleared externally (e.g. clearFilters)
  useEffect(() => {
    setInputVal(value ?? '');
  }, [value]);

  const fireSearch = useCallback(
    (q) => {
      clearTimeout(debounceRef.current);
      if (q === '') {
        onSearch('');
        return;
      }
      debounceRef.current = setTimeout(() => {
        onSearch(q);
      }, SEARCH.DEBOUNCE_MS);
    },
    [onSearch],
  );

  const handleChange = (e) => {
    const q = e.target.value;
    setInputVal(q);
    fireSearch(q);
  };

  const handleClear = () => {
    setInputVal('');
    onSearch('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') handleClear();
  };

  // Clean up pending debounce on unmount
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const showClear = inputVal.length > 0;

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1">
          {/* Search icon */}
          <span
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          >
            <Search size={18} />
          </span>

          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Search by name or SKU…"
            value={inputVal}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            aria-label="Search products"
            className="
              w-full min-h-[44px]
              pl-10 pr-10 py-2
              text-base text-gray-800
              bg-white border border-gray-200 rounded-xl
              focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent
              placeholder:text-gray-400
            "
          />

          {/* Clear button */}
          {showClear && (
            <button
              onClick={handleClear}
              aria-label="Clear search"
              className="
                absolute right-2 top-1/2 -translate-y-1/2
                flex items-center justify-center w-7 h-7
                rounded-full text-gray-400
                hover:bg-gray-100 hover:text-gray-600
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400
                transition-colors
              "
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Advanced filter trigger */}
        <button
          onClick={onAdvancedOpen}
          aria-label="Advanced filters"
          aria-haspopup="dialog"
          className={`
            relative flex items-center justify-center
            min-w-[44px] min-h-[44px] rounded-xl
            border transition-colors
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400
            ${
              hasAdvancedActive
                ? 'border-amber-500 bg-amber-50 text-amber-600'
                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            }
          `}
        >
          <SlidersHorizontal size={18} />
          {hasAdvancedActive && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white"
            />
          )}
        </button>
      </div>

      {/* Recent searches — only shown when input is empty and recents exist */}
      {!showClear && recentSearches.length > 0 && (
        <RecentSearches searches={recentSearches} onSelect={onRecentSelect} />
      )}
    </div>
  );
}

// ─── RecentSearches (co-located, also exported for independent use) ──────────

/**
 * RecentSearches
 * Displays up to 5 recent search terms as tappable chips.
 * Session-only — state is owned by catalog/page.jsx, not persisted.
 *
 * Props:
 *   searches     — string[] (max 5, most-recent first)
 *   onSelect(q)  — fires when a chip is tapped
 */
export function RecentSearches({ searches, onSelect }) {
  if (!searches.length) return null;

  return (
    <div
      role="list"
      aria-label="Recent searches"
      className="flex flex-wrap items-center gap-2 pt-1"
    >
      <span className="text-xs text-gray-400 font-medium shrink-0">Recent:</span>
      {searches.map((q) => (
        <button
          key={q}
          role="listitem"
          onClick={() => onSelect(q)}
          className="
            inline-flex items-center gap-1
            min-h-[36px] px-3 py-1
            text-xs font-medium text-gray-600
            bg-gray-100 hover:bg-amber-50 hover:text-amber-700
            rounded-full border border-transparent hover:border-amber-200
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400
            transition-colors
          "
        >
          <Search size={11} className="shrink-0 opacity-60" aria-hidden="true" />
          {q}
        </button>
      ))}
    </div>
  );
}