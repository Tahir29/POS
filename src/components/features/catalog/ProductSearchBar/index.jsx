'use client';

// src/components/features/catalog/ProductSearchBar/index.jsx
// Unified search + barcode scan input.
//
// Text search: debounced, fires onSearch(q) after DEBOUNCE_MS.
// Barcode scan: scanners fire a full item_code + Enter in <80ms.
//   Detection: if Enter fires within SCAN_THRESHOLD_MS of the last keystroke
//   AND input matches a likely code pattern → fires onBarcodeDetected(code).
//   The page handles the redirect to /products/[item_id].

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, ScanBarcode } from 'lucide-react';
import { Input } from '@/components/ui/input';
import APP_CONFIG from '@/constants/appConfig';
import BarcodeScannerModal from '@/components/features/catalog/BarcodeScannerModal';

const { SEARCH } = APP_CONFIG;

// If Enter is pressed within this many ms of the last keystroke, treat as scan.
const SCAN_THRESHOLD_MS = 80;

/**
 * @param {object}    props
 * @param {string}    props.value              - Controlled value from URL/parent
 * @param {function}  props.onSearch           - Called with debounced text query
 * @param {function}  props.onBarcodeDetected  - Called with raw code string on scan
 * @param {string[]}  props.recentSearches     - Recent search terms
 * @param {function}  props.onRecentSelect     - Called when a recent term is tapped
 */
export default function ProductSearchBar({
  value,
  onSearch,
  onBarcodeDetected,
  recentSearches = [],
  onRecentSelect,
}) {
  const [inputVal,      setInputVal]      = useState(value ?? '');
  const [cameraOpen,    setCameraOpen]    = useState(false);
  const debounceRef    = useRef(null);
  const lastKeyTimeRef = useRef(null);
  const inputRef      = useRef(null);

  // Sync when URL is cleared externally (e.g. clearFilters)
  useEffect(() => {
    setInputVal(value ?? '');
  }, [value]);

  const fireSearch = useCallback((q) => {
    clearTimeout(debounceRef.current);
    if (q === '') { onSearch(''); return; }
    debounceRef.current = setTimeout(() => onSearch(q), SEARCH.DEBOUNCE_MS);
  }, [onSearch]);

  const handleChange = (e) => {
    lastKeyTimeRef.current = Date.now();
    setInputVal(e.target.value);
    fireSearch(e.target.value);
  };

  const handleClear = () => {
    setInputVal('');
    onSearch('');
    inputRef.current?.focus();
  };

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      handleClear();
      return;
    }

    if (e.key === 'Enter') {
      const val = inputVal.trim();
      if (!val) return;

      // Barcode detection: Enter fired very quickly after last keystroke = scanner
      const timeSinceLastKey = lastKeyTimeRef.current
        ? Date.now() - lastKeyTimeRef.current
        : Infinity;

      if (timeSinceLastKey <= SCAN_THRESHOLD_MS && onBarcodeDetected) {
        // Clear debounced text search — barcode takes over
        clearTimeout(debounceRef.current);
        onBarcodeDetected(val);
      }
      // else: normal Enter — let debounce handle it
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputVal, onBarcodeDetected]);

  // Camera scan icon — opens modal
  const handleScanIconClick = () => setCameraOpen(true);

    // Camera modal detected a code
  const handleCameraDetected = useCallback((code) => {
    setCameraOpen(false);
    setInputVal(code);
    if (onBarcodeDetected) {
      onBarcodeDetected(code);
    }
  }, [onBarcodeDetected]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const showClear   = inputVal.length > 0;
  const showRecents = !showClear && recentSearches.length > 0;

  return (
    <>
      <div className="flex flex-col gap-2 w-full">
        <div className="relative flex-1">

          {/* Search icon — left */}
          <span
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          >
            <Search size={16} />
          </span>

          <Input
            ref={inputRef}
            type="search"
            inputMode="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Search For Product"
            value={inputVal}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            aria-label="Search products or scan barcode"
            className="min-h-[44px] pl-9 pr-16"
          />

          {/* Right side: clear OR barcode icon */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {showClear ? (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear search"
                className="flex items-center justify-center w-6 h-6 rounded-full text-muted-foreground hover:bg-stone-100 hover:text-foreground transition-colors"
              >
                <X size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleScanIconClick}
                aria-label="Open camera to scan barcode"
                title="Scan barcode with camera"
                className="flex items-center justify-center w-7 h-7 rounded-full transition-colors text-muted-foreground hover:text-primary hover:bg-primary/10"
              >
                <ScanBarcode size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Recent searches */}
        {showRecents && (
          <div
            role="list"
            aria-label="Recent searches"
            className="flex-wrap items-center gap-2 hidden"
          >
            <span className="text-xs text-muted-foreground font-medium shrink-0">Recent:</span>
            {recentSearches.map((q) => (
              <button
                key={q}
                role="listitem"
                type="button"
                onClick={() => onRecentSelect(q)}
                className="inline-flex items-center gap-1 min-h-[28px] px-3 py-1 text-xs font-medium text-muted-foreground bg-stone-100 hover:bg-primary/10 hover:text-primary rounded-full border border-transparent hover:border-primary/20 transition-colors"
              >
                <Search size={10} className="shrink-0 opacity-60" aria-hidden="true" />
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Camera barcode scanner modal */}
      <BarcodeScannerModal
        isOpen={cameraOpen}
        onDetected={handleCameraDetected}
        onClose={() => setCameraOpen(false)}
      />
    </>
  );
}