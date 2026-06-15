'use client';

// src/components/features/products/QuantitySelector/index.jsx
// +/- quantity control.
// Min: 1. Max: maxQty (derived from stock, defaults to 99 if stock unknown).
// Touch targets: min 44×44px per CODING_STANDARDS.
// Controlled: quantity + onChange prop driven by parent.

import { Minus, Plus } from 'lucide-react';

/**
 * @param {{
 *   quantity: number,
 *   onChange: (newQty: number) => void,
 *   maxQty?: number,
 *   disabled?: boolean,
 * }} props
 */
export default function QuantitySelector({
  quantity,
  onChange,
  maxQty = 99,
  disabled = false,
}) {
  const canDecrement = quantity > 1;
  const canIncrement = quantity < maxQty;

  return (
    <div className="flex items-center gap-1" aria-label="Quantity selector">

      {/* Decrement */}
      <button
        type="button"
        onClick={() => canDecrement && onChange(quantity - 1)}
        disabled={disabled || !canDecrement}
        aria-label="Decrease quantity"
        className="
          flex items-center justify-center
          min-w-[44px] min-h-[44px] rounded-xl
          border border-stone-200 bg-white
          text-stone-600
          hover:bg-stone-50 hover:border-stone-300
          disabled:opacity-40 disabled:cursor-not-allowed
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400
          transition-colors
        "
      >
        <Minus size={16} aria-hidden="true" />
      </button>

      {/* Count display */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="
          flex items-center justify-center
          min-w-[52px] min-h-[44px] px-3
          text-base font-semibold text-stone-800
          border border-stone-200 rounded-xl bg-white
          select-none
        "
      >
        {quantity}
      </div>

      {/* Increment */}
      <button
        type="button"
        onClick={() => canIncrement && onChange(quantity + 1)}
        disabled={disabled || !canIncrement}
        aria-label="Increase quantity"
        className="
          flex items-center justify-center
          min-w-[44px] min-h-[44px] rounded-xl
          border border-stone-200 bg-white
          text-stone-600
          hover:bg-stone-50 hover:border-stone-300
          disabled:opacity-40 disabled:cursor-not-allowed
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400
          transition-colors
        "
      >
        <Plus size={16} aria-hidden="true" />
      </button>

      {/* Max stock label */}
      {maxQty < 99 && (
        <span className="text-xs text-stone-400 pl-1">
          of {maxQty}
        </span>
      )}
    </div>
  );
}
