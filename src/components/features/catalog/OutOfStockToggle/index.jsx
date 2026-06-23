'use client';

// src/components/features/catalog/OutOfStockToggle/index.jsx
// Labeled toggle switch — shows/hides out-of-stock products.
// ON  = show all products including OOS (amber active state)
// OFF = show in-stock only (default, grey)

import { Package } from 'lucide-react';

export default function OutOfStockToggle({ showOutOfStock, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={showOutOfStock}
      onClick={() => onToggle(!showOutOfStock)}
      className={[
        'flex items-center gap-2 min-h-[44px] px-3 py-2 rounded-full shrink-0',
        'text-sm font-medium border transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        showOutOfStock
          ? 'bg-amber-50 border-amber-300 text-amber-700'
          : 'bg-white border-border text-muted-foreground hover:border-stone-300',
      ].join(' ')}
    >
      <Package size={15} className="shrink-0" />

      {/* Text label — hidden on very small screens */}
      <span className="hidden sm:inline whitespace-nowrap text-xs">
        {showOutOfStock ? 'Showing OOS' : 'Show OOS'}
      </span>

      {/* Toggle pill */}
      <div
        className={[
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200',
          showOutOfStock ? 'bg-amber-400' : 'bg-stone-200',
        ].join(' ')}
        aria-hidden="true"
      >
        <span
          className={[
            'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm',
            'transform transition-transform duration-200',
            showOutOfStock ? 'translate-x-4' : 'translate-x-1',
          ].join(' ')}
        />
      </div>
    </button>
  );
}