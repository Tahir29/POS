'use client';

// src/components/features/products/SizeSelector/index.jsx
//
// Size selection sheet for the product detail screen.
// Opens via the shared BottomSheet component.
// Parent controls isOpen / onClose — this component owns only the grid UI.
//
// Props:
//   sizes          object[]              — from useItemSizes()
//   selectedSizeId number | null         — currently selected size ID
//   onSelect       (id, name) => void    — called when a size chip is tapped; also closes sheet
//   isLoading      boolean
//   isOpen         boolean               — controlled by parent page
//   onClose        () => void            — controlled by parent page

import BottomSheet from '@/components/shared/BottomSheet';
import { Skeleton } from '@/components/ui/skeleton';

export default function SizeSelector({
  sizes,
  selectedSizeId,
  onSelect,
  isLoading,
  isOpen,
  onClose,
}) {
  const safeSizes = Array.isArray(sizes) ? sizes : [];

  const selectedSize = safeSizes.find((s) => s.size_id === selectedSizeId);

  const handleSelect = (sizeId, sizeName) => {
    onSelect(sizeId, sizeName);
    // Don't auto-close — let user confirm via footer button
  };

  // ── Footer: Confirm button ────────────────────────────────────────────────
  const footer = selectedSizeId ? (
    <button
      type="button"
      onClick={onClose}
      className="
        w-full min-h-[48px] rounded-xl
        bg-amber-500 hover:bg-amber-600 active:scale-[0.98]
        text-white font-semibold text-sm
        transition-all duration-150
      "
    >
      Confirm — Size {selectedSize?.size_name ?? ''}
    </button>
  ) : null;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Select Size"
      footer={footer}
      maxWidth="max-w-lg"
    >
      {/* Selected indicator */}
      {selectedSizeId && (
        <p className="text-xs text-amber-600 font-medium mb-3">
          Selected: {selectedSize?.size_name ?? ''}
          {selectedSize?.size_value ? ` — ${selectedSize.size_value} mm` : ''}
        </p>
      )}

      {/* Loading skeleton */}
      {isLoading ? (
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 15 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : safeSizes.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-10">
          No sizes available for this product.
        </p>
      ) : (
        // Size grid
        <div
          role="listbox"
          aria-label="Available sizes"
          className="grid grid-cols-5 gap-2"
        >
          {safeSizes.map((size) => {
            const isSelected = size.size_id === selectedSizeId;
            const label = size.size_name ?? size.size_value ?? String(size.size_id);
            return (
              <button
                key={size.size_id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(size.size_id, label)}
                className={`
                  min-h-[52px] px-2 py-2 rounded-xl
                  border text-sm font-medium
                  flex flex-col items-center justify-center gap-0.5
                  transition-all duration-150
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400
                  ${isSelected
                    ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                    : 'bg-card border-border text-stone-700 hover:border-amber-300 hover:bg-amber-50'
                  }
                `}
              >
                <span className="leading-none">{label}</span>
                {size.size_value && size.size_value !== label && (
                  <span
                    className={`text-[10px] leading-none ${
                      isSelected ? 'text-amber-100' : 'text-stone-400'
                    }`}
                  >
                    {size.size_value} mm
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}
