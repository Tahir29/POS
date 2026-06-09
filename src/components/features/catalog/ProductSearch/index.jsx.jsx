'use client';

// src/components/features/catalog/ProductSearch/index.jsx
// Debounced search input for the catalog header.
// Fires onSearch after SEARCH.DEBOUNCE_MS (300ms) of inactivity.
// Controlled externally — value and onSearch come from CatalogPage.
// Phase 6 will extend this with advanced filters; the input itself is complete here.

import { useEffect, useRef, useState } from 'react';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {{
 *   value: string,
 *   onSearch: (query: string) => void,
 *   placeholder?: string,
 * }} props
 */
export default function ProductSearch({
  value,
  onSearch,
  placeholder = 'Search by name or SKU…',
}) {
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef(null);

  // Keep local in sync when parent resets (e.g. clear filters)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  function handleChange(e) {
    const query = e.target.value;
    setLocalValue(query);

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSearch(query);
    }, APP_CONFIG.SEARCH.DEBOUNCE_MS);
  }

  function handleClear() {
    setLocalValue('');
    clearTimeout(timerRef.current);
    onSearch('');
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <div className="relative flex items-center">
      {/* Search icon */}
      <svg
        className="pointer-events-none absolute left-3 h-4 w-4 text-stone-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
      </svg>

      <input
        type="search"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label="Search products"
        // text-base (16px) prevents iOS auto-zoom on focus — CODING_STANDARDS Section 12
        className="min-h-11 w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-9 pr-10 text-base text-stone-800 placeholder:text-stone-400 transition-colors hover:border-stone-300 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
      />

      {/* Clear button — only visible when there's input */}
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2 flex min-h-8 min-w-8 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
