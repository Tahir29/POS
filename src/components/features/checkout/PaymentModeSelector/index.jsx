'use client';

// src/components/features/checkout/PaymentModeSelector/index.jsx
// List of payment modes as selectable tiles. Supports multi-select for
// split payments — selecting a mode adds it to the active payment split;
// deselecting removes it.

import { Loader2, CreditCard, Check } from 'lucide-react';

/**
 * @param {{
 *   paymentModes: { modeId: number, modeName: string }[],
 *   selectedModeIds: number[],
 *   onToggle: (modeId: number) => void,
 *   isLoading?: boolean,
 *   isError?: boolean,
 * }} props
 */
export default function PaymentModeSelector({
  paymentModes,
  selectedModeIds,
  onToggle,
  isLoading,
  isError,
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-stone-500">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        Loading payment modes…
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive py-2">
        Failed to load payment modes. Please try again.
      </p>
    );
  }

  if (paymentModes.length === 0) {
    return (
      <p className="text-sm text-stone-500 py-2">No payment modes available.</p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {paymentModes.map((mode) => {
        const isSelected = selectedModeIds.includes(mode.modeId);
        return (
          <button
            key={mode.modeId}
            type="button"
            onClick={() => onToggle(mode.modeId)}
            aria-pressed={isSelected}
            className={`
              flex items-center gap-2 min-h-[48px] px-3 py-2.5 rounded-xl
              border text-sm font-medium transition-colors
              ${isSelected
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'}
            `}
          >
            <span
              className={`
                flex h-5 w-5 shrink-0 items-center justify-center rounded-full border
                ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-stone-300'}
              `}
              aria-hidden="true"
            >
              {isSelected && <Check size={12} />}
            </span>
            <CreditCard size={16} className="shrink-0 text-stone-400" aria-hidden="true" />
            <span className="truncate">{mode.modeName}</span>
          </button>
        );
      })}
    </div>
  );
}