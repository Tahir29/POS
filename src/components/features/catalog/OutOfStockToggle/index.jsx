'use client';

// src/components/features/catalog/OutOfStockToggle/index.jsx
// Labeled toggle switch — shows/hides out-of-stock products.
// Restyled to a plain label + switch (no icon/pill/border) to match
// the new design's minimal treatment.

export default function OutOfStockToggle({ showOutOfStock, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={showOutOfStock}
      onClick={() => onToggle(!showOutOfStock)}
      className="flex items-center gap-2 shrink-0 min-h-[44px] px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
    >
      <span className="hidden sm:inline text-sm text-muted-foreground whitespace-nowrap">
        Show Out of Stock
      </span>

      <span
        className={[
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200',
          showOutOfStock ? 'bg-primary' : 'bg-stone-200',
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
      </span>
    </button>
  );
}
