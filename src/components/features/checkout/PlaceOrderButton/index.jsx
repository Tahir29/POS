'use client';

// src/components/features/checkout/PlaceOrderButton/index.jsx
// Submits the sale via useCreateInvoice or useCreateOrder. Disabled until
// checkoutSchema validation passes (customer attached, sales person picked).
//
// The button REPORTS the outcome, it does not offer a choice — there is no
// mode selector on this screen any more (see checkout/page.jsx). It says what
// is about to be raised and for how much money is changing hands right now:
// on an order that is the advance being taken, not the order's value, because
// the smaller figure is what the customer is actually handing over.

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartTotals } from '@/hooks/cart/useCartTotals';

const money = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/**
 * @param {{
 *   isValid: boolean,
 *   isPlacingOrder: boolean,
 *   onPlaceOrder: () => void,
 *   amountDue?: number,     — live-priced total (see useCheckoutPricing)
 *   amountCollected?: number, — what the payment rows currently add up to
 *   isPricing?: boolean,
 *   documentType?: 'invoice'|'order',
 * }} props
 */
export default function PlaceOrderButton({
  isValid, isPlacingOrder, onPlaceOrder, amountDue, amountCollected,
  isPricing, documentType = 'invoice',
}) {
  const { total: cartTotal } = useCartTotals();
  const total = amountDue ?? cartTotal;
  const isOrder = documentType === 'order';

  // An order can be part-paid, so show the advance actually entered; an
  // invoice always settles in full, so the two are the same number.
  const chargeable = isOrder ? (amountCollected ?? 0) : total;

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
          {isOrder ? 'Placing order…' : 'Generating invoice…'}
        </>
      ) : isPricing ? (
        <>
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          Pricing items…
        </>
      ) : isOrder ? (
        // No advance is a legitimate order, so don't label it "Advance ₹0".
        chargeable > 0
          ? `Place Order · Advance ${money(chargeable)}`
          : 'Place Order · No advance'
      ) : (
        `Complete Sale · ${money(chargeable)}`
      )}
    </Button>
  );
}