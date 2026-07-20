'use client';

// src/components/features/cart/CartItemQuantityControl/index.jsx
// +/- quantity stepper for a cart item.
// Decrementing to 0 removes the item (handled by parent via useCart.updateQuantity).

import QuantityStepper from '@/components/shared/QuantityStepper';

/**
 * @param {{
 *   quantity: number,
 *   onIncrement: () => void,
 *   onDecrement: () => void,
 * }} props
 */
export default function CartItemQuantityControl({ quantity, onIncrement, onDecrement }) {
  return (
    <QuantityStepper quantity={quantity} onDecrement={onDecrement} onIncrement={onIncrement} />
  );
}
