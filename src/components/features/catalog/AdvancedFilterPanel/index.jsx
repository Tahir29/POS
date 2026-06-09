'use client';

import { useEffect, useRef } from 'react';
import { X, SlidersHorizontal } from 'lucide-react';
import WeightRangeFilter from '@/components/features/catalog/WeightRangeFilter';
import DiamondWeightFilter from '@/components/features/catalog/DiamondWeightFilter';

/**
 * AdvancedFilterPanel
 * Slide-in panel (right-anchored) with weight range filters.
 * Renders as an overlay on tablet/mobile.
 *
 * Props:
 *   isOpen           — boolean
 *   onClose()        — callback
 *   filters          — { fromWeight, toWeight, fromDiamondWeight, toDiamondWeight }
 *   actions          — { setWeightRange, setDiamondWeightRange, clearFilters }
 *   hasActiveFilters — boolean
 */
export default function AdvancedFilterPanel({
  isOpen,
  onClose,
  filters,
  actions,
  hasActiveFilters,
}) {
  const panelRef = useRef(null);

  // Trap focus inside panel when open; close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when panel is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleClearAdvanced = () => {
    actions.setWeightRange(null, null);
    actions.setDiamondWeightRange(null, null);
  };

  const advancedActive =
    filters.fromWeight !== null ||
    filters.toWeight !== null ||
    filters.fromDiamondWeight !== null ||
    filters.toDiamondWeight !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`
          fixed inset-0 z-40 bg-black/40 transition-opacity duration-200
          ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Advanced filters"
        className={`
          fixed top-0 right-0 z-50
          h-full w-[320px] max-w-[90vw]
          flex flex-col
          bg-white shadow-xl
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-amber-600" />
            <h2 className="text-base font-semibold text-gray-900">Advanced Filters</h2>
            {advancedActive && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                !
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close advanced filters"
            className="
              flex items-center justify-center w-11 h-11 -mr-2
              rounded-lg text-gray-500
              hover:bg-gray-100 focus-visible:outline-none
              focus-visible:ring-2 focus-visible:ring-amber-400
              transition-colors
            "
          >
            <X size={20} />
          </button>
        </div>

        {/* Filter body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-8">

          {/* Gross weight */}
          <WeightRangeFilter
            label="Gross Weight (g)"
            fromValue={filters.fromWeight}
            toValue={filters.toWeight}
            onApply={(from, to) => actions.setWeightRange(from, to)}
          />

          {/* Divider */}
          <div className="h-px bg-gray-100" />

          {/* Diamond weight */}
          <DiamondWeightFilter
            fromValue={filters.fromDiamondWeight}
            toValue={filters.toDiamondWeight}
            onApply={(from, to) => actions.setDiamondWeightRange(from, to)}
          />
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={handleClearAdvanced}
            disabled={!advancedActive}
            className="
              flex-1 min-h-[44px] px-4 py-2
              text-sm font-medium text-gray-600
              border border-gray-200 rounded-lg
              hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400
              transition-colors
            "
          >
            Clear
          </button>
          <button
            onClick={onClose}
            className="
              flex-1 min-h-[44px] px-4 py-2
              text-sm font-semibold text-white
              bg-amber-500 hover:bg-amber-600 rounded-lg
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400
              transition-colors
            "
          >
            Apply
          </button>
        </div>
      </aside>
    </>
  );
}