'use client';

// src/components/features/cart/CartSummary/index.jsx
// Subtotal / discount / total breakdown.
//
// REUSE NOTE: This component is intentionally pure/presentational and
// driven entirely by useCartTotals(). It is used in the Cart Drawer
// (Phase 8) and is designed to be reused as-is on the Checkout screen
// and any order review/confirmation step (Phase 9+) — do not add
// drawer-specific logic (e.g. close handlers) here.

import { useCartTotals } from '@/hooks/cart/useCartTotals';

/**
 * @param {{ totals?: {subTotal, taxAmount, netAmount}|null, isPricing?: boolean }} props
 *   totals — server-priced figures for the ACTUAL stock pieces
 *   (useCheckoutPricing). When present these win over the cart's own
 *   estimate, because they are what the invoice is raised at and what the
 *   customer is charged. Showing the cart estimate next to a Place Order
 *   button carrying the real figure is exactly the mismatch this prevents.
 */
export default function CartSummary({ totals = null, isPricing = false }) {
  const cart = useCartTotals();

  const subtotal = totals ? totals.subTotal  : cart.subtotal;
  const tax      = totals ? totals.taxAmount : cart.tax;
  const total    = totals ? Math.round(totals.netAmount) : cart.total;
  const discount = cart.discount;

  return (
    <div className="flex flex-col gap-2 py-3" aria-busy={isPricing || undefined}>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Subtotal</span>
        <span className="font-medium text-foreground">
          ₹{subtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </span>
      </div>

      {discount > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Discount</span>
          <span className="font-medium text-status-in-stock">
            −₹{discount.toLocaleString('en-IN')}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        {/* Only the cart's own figure is the flat-3% estimate; the priced
            one is the server's real per-item tax. */}
        <span>{totals ? 'GST' : 'GST (3%)'}</span>
        <span className="font-medium text-foreground">
          ₹{tax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </span>
      </div>

      <div className="h-px w-full bg-grad-hairline mt-1" aria-hidden="true" />

      <div className="flex items-center justify-between pt-1">
        <span className="text-base font-bold text-foreground">Total</span>
        <span className="font-heading text-xl font-semibold text-primary tabular-nums">
          ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}
