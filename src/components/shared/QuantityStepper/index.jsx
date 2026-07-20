'use client';

// src/components/shared/QuantityStepper/index.jsx
//
// Shared +/- quantity control. Was independently hand-built in
// QuantitySelector (product detail, 44px touch targets per
// CODING_STANDARDS) and CartItemQuantityControl (cart row, 34px targets,
// no focus-visible ring) — the two had drifted on touch-target size and
// accessibility. Standardizes on the 44px minimum.

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEP_BUTTON = 'flex items-center justify-center min-w-[44px] min-h-[44px] text-stone-600 hover:bg-stone-50 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors';

/**
 * @param {{
 *   quantity: number,
 *   onDecrement: () => void,
 *   onIncrement: () => void,
 *   decrementDisabled?: boolean,
 *   incrementDisabled?: boolean,
 *   disabled?: boolean,
 *   trailing?: React.ReactNode,
 *   className?: string,
 * }} props
 */
export default function QuantityStepper({
  quantity,
  onDecrement,
  onIncrement,
  decrementDisabled = false,
  incrementDisabled = false,
  disabled = false,
  trailing,
  className,
}) {
  return (
    <div
      className={cn('flex items-center gap-1 rounded-lg border border-border bg-card', className)}
      aria-label="Quantity selector"
    >
      <button
        type="button"
        onClick={onDecrement}
        disabled={disabled || decrementDisabled}
        aria-label="Decrease quantity"
        className={cn(STEP_BUTTON, 'rounded-l-lg')}
      >
        <Minus size={16} aria-hidden="true" />
      </button>

      <span
        aria-live="polite"
        aria-atomic="true"
        className="flex items-center justify-center min-w-[44px] px-2 text-base font-semibold text-stone-800 tabular-nums select-none"
      >
        {quantity}
      </span>

      <button
        type="button"
        onClick={onIncrement}
        disabled={disabled || incrementDisabled}
        aria-label="Increase quantity"
        className={cn(STEP_BUTTON, 'rounded-r-lg')}
      >
        <Plus size={16} aria-hidden="true" />
      </button>

      {trailing}
    </div>
  );
}
