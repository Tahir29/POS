'use client';

// src/components/features/cart/CartItemQuantityControl/index.jsx
// +/- quantity stepper for a cart item.
// Decrementing to 0 removes the item (handled by parent via useCart.updateQuantity).

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * @param {{
 *   quantity: number,
 *   onIncrement: () => void,
 *   onDecrement: () => void,
 * }} props
 */
export default function CartItemQuantityControl({ quantity, onIncrement, onDecrement }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white">
      <button
        type="button"
        onClick={onDecrement}
        aria-label="Decrease quantity"
        className={cn(
          'min-h-[34px] min-w-[34px] flex items-center justify-center',
          'rounded-l-lg text-stone-600 hover:bg-stone-100 active:scale-95',
          'transition-colors'
        )}
      >
        <Minus size={16} aria-hidden="true" />
      </button>

      <span
        className="min-w-[2rem] text-center text-sm font-semibold text-stone-800 tabular-nums"
        aria-live="polite"
      >
        {quantity}
      </span>

      <button
        type="button"
        onClick={onIncrement}
        aria-label="Increase quantity"
        className={cn(
          'min-h-[34px] min-w-[34px] flex items-center justify-center',
          'rounded-r-lg text-stone-600 hover:bg-stone-100 active:scale-95',
          'transition-colors'
        )}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}