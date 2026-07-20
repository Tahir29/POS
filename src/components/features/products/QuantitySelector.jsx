'use client';

// src/components/features/products/QuantitySelector/index.jsx
// +/- quantity control.
// Min: 1. Max: maxQty (derived from stock, defaults to 99 if stock unknown).
// Controlled: quantity + onChange prop driven by parent.

import QuantityStepper from '@/components/shared/QuantityStepper';

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
    <QuantityStepper
      quantity={quantity}
      onDecrement={() => canDecrement && onChange(quantity - 1)}
      onIncrement={() => canIncrement && onChange(quantity + 1)}
      decrementDisabled={!canDecrement}
      incrementDisabled={!canIncrement}
      disabled={disabled}
      trailing={maxQty < 99 && (
        <span className="text-xs text-stone-400 pl-1">
          of {maxQty}
        </span>
      )}
    />
  );
}
