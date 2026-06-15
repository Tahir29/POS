'use client';

// src/components/features/catalog/ProductSearchBar/index.jsx
//
// Compact debounced search input.
// Advanced filter trigger removed — AdvancedFilterPanel deleted.
// Sits inline with the category filter row in the catalog header.

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import APP_CONFIG from '@/constants/appConfig';

const { SEARCH } = APP_CONFIG;

export default function ProductSearchBar({
  value,
  onSearch,
  recentSearches  = [],
  onRecentSelect,
}) {
  const [inputVal, setInputVal] = useState(value ?? '');
  const debounceRef = useRef(null);
  const inputRef    = useRef(null);

  // Sync when URL is cleared externally
  useEffect(() => {
    setInputVal(value ?? '');
  }, [value]);

  const fireSearch = useCallback(
    (q) => {
      clearTimeout(debounceRef.current);
      if (q === '') { onSearch(''); return; }
      debounceRef.current = setTimeout(() => onSearch(q), SEARCH.DEBOUNCE_MS);
    },
    [onSearch],
  );

  const handleChange  = (e) => { setInputVal(e.target.value); fireSearch(e.target.value); };
  const handleClear   = () => { setInputVal(''); onSearch(''); inputRef.current?.focus(); };
  const handleKeyDown = (e) => { if (e.key === 'Escape') handleClear(); };

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const showClear   = inputVal.length > 0;
  const showRecents = !showClear && recentSearches.length > 0;

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="relative">
        <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
          <Search size={16} />
        </span>

        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Search products…"
          value={inputVal}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          aria-label="Search products"
          className="
            w-full min-h-[40px]
            pl-9 pr-8 py-2
            text-sm text-foreground
            bg-card border border-border rounded-xl
            focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
            placeholder:text-muted-foreground
            transition-colors
          "
        />

        {showClear && (
          <button
            onClick={handleClear}
            aria-label="Clear search"
            className="
              absolute right-2 top-1/2 -translate-y-1/2
              flex items-center justify-center w-6 h-6
              rounded-full text-muted-foreground
              hover:bg-secondary hover:text-foreground
              transition-colors
            "
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Recent searches */}
      {showRecents && (
        <div role="list" aria-label="Recent searches" className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium shrink-0">Recent:</span>
          {recentSearches.map((q) => (
            <button
              key={q}
              role="listitem"
              onClick={() => onRecentSelect(q)}
              className="
                inline-flex items-center gap-1 min-h-[32px] px-3 py-1
                text-xs font-medium text-muted-foreground
                bg-secondary hover:bg-accent/10 hover:text-accent
                rounded-full border border-border hover:border-accent/30
                transition-colors
              "
            >
              <Search size={10} className="shrink-0 opacity-60" aria-hidden="true" />
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
