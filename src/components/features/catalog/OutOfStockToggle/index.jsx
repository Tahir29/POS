'use client';

// src/components/features/catalog/OutOfStockToggle/index.jsx
// Toggle to show/hide out-of-stock products in the catalog.
// When ON: all products shown + OOS badge visible on cards.
// When OFF: only in-stock products shown (default).

import { Eye, EyeOff } from 'lucide-react';

/**
 * @param {object}   props
 * @param {boolean}  props.showOutOfStock  - Current toggle state
 * @param {function} props.onToggle        - Called with new boolean value
 */
export default function OutOfStockToggle({ showOutOfStock, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={showOutOfStock}
      onClick={() => onToggle(!showOutOfStock)}
      title={showOutOfStock ? 'Hiding out-of-stock items' : 'Show out-of-stock items'}
      className={[
        'flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-full',
        'text-sm font-medium border transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        showOutOfStock
          ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
          : 'bg-white border-border text-muted-foreground hover:border-stone-300 hover:text-foreground',
      ].join(' ')}
    >
      {showOutOfStock ? (
        <>
          <Eye size={15} className="shrink-0" />
          <span className="hidden sm:inline whitespace-nowrap">Show OOS</span>
        </>
      ) : (
        <>
          <EyeOff size={15} className="shrink-0" />
          <span className="hidden sm:inline whitespace-nowrap">Show OOS</span>
        </>
      )}
    </button>
  );
}