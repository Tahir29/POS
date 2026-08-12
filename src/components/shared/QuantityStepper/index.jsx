'use client';

// src/components/shared/QuantityStepper/index.jsx
//
// Shared +/- quantity control. Was independently hand-built in
// QuantitySelector (product detail, 44px touch targets per
// CODING_STANDARDS) and CartItemQuantityControl (cart row, 34px targets,
// no focus-visible ring) — the two had drifted on touch-target size and
// accessibility. Standardizes on the 44px minimum.

import { Minus, Plus } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { EASE_PREMIUM, DURATION } from '@/lib/motion';

const STEP_BUTTON = 'flex items-center justify-center min-w-[44px] min-h-[44px] text-muted-foreground hover:bg-muted active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors';

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
  const reduceMotion = useReducedMotion();

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

      {/* aria-live/atomic stay on this OUTER, never-remounted element so
          screen readers still announce every change — only the INNER span
          swaps (Step C Priority 3), keyed by the value itself so each
          change gets its own brief crossfade instead of an instant digit
          swap. Reduced-motion renders the plain value with no wrapper
          animation at all. */}
      <span
        aria-live="polite"
        aria-atomic="true"
        className="relative flex items-center justify-center min-w-[44px] px-2 text-base font-semibold text-foreground overflow-hidden"
      >
        {reduceMotion ? (
          <span className="tabular-nums select-none">{quantity}</span>
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={quantity}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: DURATION.micro, ease: EASE_PREMIUM }}
              className="tabular-nums select-none"
            >
              {quantity}
            </motion.span>
          </AnimatePresence>
        )}
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
