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
 *   amountDue?: number,   — live-priced invoice total (see useCheckoutPricing)
 *   isPricing?: boolean,
 * }} props
 */
export default function PlaceOrderButton({
  isValid, isPlacingOrder, onPlaceOrder, amountDue, isPricing,
}) {
  const { total: cartTotal } = useCartTotals();
  const total = amountDue ?? cartTotal;

  return (
    <Button
      type="button"
      variant="premium"
      onClick={onPlaceOrder}
      disabled={!isValid || isPlacingOrder || isPricing}
      className="h-12 w-full text-base font-semibold"
    >
      {isPlacingOrder ? (
        <>
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          Generating invoice…
        </>
      ) : isPricing ? (
        <>
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          Pricing items…
        </>
      ) : (
        `Place Order · ₹${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
      )}
    </Button>
  );
}