'use client';

// src/components/features/checkout/PlaceOrderButton/index.jsx
// Submits the order via useCreateOrder. Disabled until checkoutSchema
// validation passes (customer attached, payments balanced).

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartTotals } from '@/hooks/cart/useCartTotals';

/**
 * @param {{
 *   isValid: boolean,
 *   isPlacingOrder: boolean,
 *   onPlaceOrder: () => void,
 * }} props
 */
export default function PlaceOrderButton({ isValid, isPlacingOrder, onPlaceOrder }) {
  const { total } = useCartTotals();

  return (
    <Button
      type="button"
      onClick={onPlaceOrder}
      disabled={!isValid || isPlacingOrder}
      className="h-12 w-full text-base font-semibold"
    >
      {isPlacingOrder ? (
        <>
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          Generating invoice…
        </>
      ) : (
        `Place Order · ₹${total.toLocaleString('en-IN')}`
      )}
    </Button>
  );
}