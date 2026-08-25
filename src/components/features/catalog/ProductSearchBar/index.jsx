'use client';

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
  // Debounce for the physical/USB scanner path (handleKeyDown below) — this
  // path had NO duplicate-suppression at all, unlike the camera path in
  // BarcodeScannerModal, which already debounces repeat detections of the
  // same code within 2s. A scanner that sends a double terminator (CR+LF is
  // common), or one left in continuous/repeat-scan mode, would re-fire
  // onBarcodeDetected for every repeat with nothing to stop it — confirmed
  // 2026-08-08: this is what was hitting StockJournal/List repeatedly on a
  // single physical scan. Mirrors BarcodeScannerModal's own lastScannedRef.
  const lastScanRef    = useRef(null);

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
        // Debounce — ignore the same scanned value re-firing within 2s (a
        // double CR/LF terminator, a scanner still in the beam, or a stray
        // repeat trigger pull all look identical from here).
        const prev = lastScanRef.current;
        if (prev?.code === val && Date.now() - prev.ts < 2000) {
          return;
        }
        lastScanRef.current = { code: val, ts: Date.now() };

        // Clear debounced text search — barcode takes over
        clearTimeout(debounceRef.current);
        onBarcodeDetected(val);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputVal, onBarcodeDetected]);

  const handleScanIconClick = () => setCameraOpen(true);

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
        <div className="relative flex-1 bg-white">

          <span
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          >
            <Search size={16} />
          </span>

          <Input
            ref={inputRef}
            // type="text", not "search" — Chrome/Edge/Safari render their
            // OWN native clear ("x") button inside a type="search" input
            // once it has a value, stacking on top of our custom clear
            // button below and producing two visible "x" icons. inputMode
            // stays "search" so mobile keyboards still show a search-style
            // Enter key; that's independent of the native clear-button
            // behavior, which is keyed off the `type` attribute itself.
            type="text"
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

          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {showClear ? (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear search"
                className="flex items-center justify-center w-6 h-6 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
                className="inline-flex items-center gap-1 min-h-[28px] px-3 py-1 text-xs font-medium text-muted-foreground bg-muted hover:bg-primary/10 hover:text-primary rounded-full border border-transparent hover:border-primary/20 transition-colors"
              >
                <Search size={10} className="shrink-0 opacity-60" aria-hidden="true" />
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
      <BarcodeScannerModal
        isOpen={cameraOpen}
        onDetected={handleCameraDetected}
        onClose={() => setCameraOpen(false)}
      />
    </>
  );
}