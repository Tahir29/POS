'use client';

// Unified search + barcode scan input.
//
// Text search: debounced, fires onSearch(q) after DEBOUNCE_MS.
// Barcode scan: scanners fire a full item_code + Enter in <80ms.
//   Detection: if Enter fires within SCAN_THRESHOLD_MS of the last keystroke
//   AND input matches a likely code pattern → fires onBarcodeDetected(code).
//   The page handles the redirect to /products/[item_id].

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Search, X, ScanBarcode } from 'lucide-react';
import { Input } from '@/components/ui/input';
import APP_CONFIG from '@/constants/appConfig';

// Dynamically imported (~500KB, @zxing/browser) so the chunk only loads
// once the operator actually opens the scanner, not on every catalog
// visit. `ssr: false` is required — the modal is 100% camera/getUserMedia.
const BarcodeScannerModal = dynamic(
  () => import('@/components/features/catalog/BarcodeScannerModal'),
  { ssr: false },
);

const { SEARCH } = APP_CONFIG;

// If Enter is pressed within this many ms of the last keystroke, treat as scan.
const SCAN_THRESHOLD_MS = 80;

/**
 * @param {object}    props
 * @param {string}    props.value              - Controlled value from URL/parent
 * @param {function}  props.onSearch           - Called with debounced text query
 * @param {function}  props.onBarcodeDetected  - Called with raw code string on scan
 */
export default function ProductSearchBar({
  value,
  onSearch,
  onBarcodeDetected,
}) {
  const normalizedValue = value ?? '';
  const [inputVal,      setInputVal]      = useState(normalizedValue);
  // Tracks the last `value` prop synced FROM, so a render-time comparison
  // (below) can detect an external change (e.g. clearFilters) and correct
  // state before paint — React's documented pattern for this, safer than
  // a useEffect which paints the stale value first.
  const [lastSyncedValue, setLastSyncedValue] = useState(normalizedValue);
  const [cameraOpen,    setCameraOpen]    = useState(false);
  const debounceRef    = useRef(null);
  const lastKeyTimeRef = useRef(null);
  const inputRef      = useRef(null);
  // Debounces the physical/USB scanner path (handleKeyDown below) against a
  // scanner that sends a double terminator or is left in repeat-scan mode.
  // Mirrors BarcodeScannerModal's own lastScannedRef.
  const lastScanRef    = useRef(null);

  // Sync when URL is cleared externally (e.g. clearFilters) — during
  // render, not in an effect; see the comment on lastSyncedValue above.
  if (normalizedValue !== lastSyncedValue) {
    setLastSyncedValue(normalizedValue);
    setInputVal(normalizedValue);
  }

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
    // Must cancel any pending debounce timer directly (not via fireSearch/
    // onSearch alone) — otherwise a stale timer from the last keystroke
    // fires after Clear and silently re-applies the old query.
    clearTimeout(debounceRef.current);
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
        // Debounce — ignore the same scanned value re-firing within 2s.
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

  const showClear = inputVal.length > 0;

  return (
    <>
      <div className="w-full">
        <div className="relative flex-1 bg-white">

          <span
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          >
            <Search size={16} />
          </span>

          <Input
            ref={inputRef}
            // type="text", not "search" — a type="search" input shows its
            // own native clear button, doubling up with our custom one
            // below. inputMode="search" still gives mobile a search-style
            // Enter key regardless of `type`.
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
      </div>
      {/* Absent from the tree until opened, so the dynamic import above
          isn't triggered until the operator taps "scan" at least once. */}
      {cameraOpen && (
        <BarcodeScannerModal
          isOpen={cameraOpen}
          onDetected={handleCameraDetected}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </>
  );
}