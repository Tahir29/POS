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

// PERF (2026-09-08) — @zxing/browser (the barcode decoder this modal uses)
// is ~500KB, confirmed via a real build to be ~21% of the Catalog route's
// initial JS — and it shipped on EVERY catalog visit, whether or not the
// operator ever tapped "scan," since it was a plain static import. `ssr:
// false` is safe (and correct) here: the modal is 100% camera/getUserMedia,
// nothing it renders can exist on the server. Only fetches the chunk once
// the JSX below actually mounts it (see the conditional render), not on
// import — a dynamic() wrapper present in the tree unconditionally would
// still trigger the fetch immediately regardless of props.
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
  // Tracks the last `value` prop this component has synced FROM — lets a
  // render-time comparison detect "value changed externally" (e.g.
  // clearFilters resetting the URL query) without an effect. Calling
  // setState here, mid-render (see below), is React's own documented
  // pattern for adjusting state when a prop changes: React discards this
  // render and immediately re-renders with the corrected state before
  // anything is painted, unlike the same call inside a useEffect (the old
  // shape here), which paints the stale value first and only corrects it a
  // frame later — and trips react-hooks/set-state-in-effect besides.
  const [lastSyncedValue, setLastSyncedValue] = useState(normalizedValue);
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
    // FIXED 2026-09-09 — CONFIRMED bug: this called onSearch('') directly,
    // bypassing fireSearch, so it never cancelled a debounce timer still
    // pending from the last keystroke. Typing "ring" then clicking Clear
    // within the debounce window (SEARCH.DEBOUNCE_MS) cleared the URL's `q`
    // param for a moment, but the stale timer scheduled by that last
    // keystroke fired shortly after with the OLD query, silently
    // re-applying it — the URL never actually stayed cleared, and the
    // catalog stayed stuck in search mode showing the old (restricted)
    // results. clearTimeout here (an event handler, not render — this
    // repo's lint forbids ref access during render, which is why this
    // isn't done in the render-time value-sync block above instead) stops
    // that stale timer from ever firing.
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
      </div>
      {/* Mounted only once actually opened (2026-09-08) — not just
          rendering null while closed, but absent from the tree entirely,
          so the dynamic import above isn't triggered until the operator
          taps "scan" at least once. Cheap on every reopen after the
          first — dynamic() caches the loaded module. */}
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