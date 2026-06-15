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

export default function CartSummary() {
  const { subtotal, discount, total } = useCartTotals();

  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="flex items-center justify-between text-sm text-stone-600">
        <span>Subtotal</span>
        <span className="font-medium text-stone-800">
          ₹{subtotal.toLocaleString('en-IN')}
        </span>
      </div>

      {discount > 0 && (
        <div className="flex items-center justify-between text-sm text-stone-600">
          <span>Discount</span>
          <span className="font-medium text-emerald-600">
            −₹{discount.toLocaleString('en-IN')}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 mt-1 border-t border-stone-100">
        <span className="text-base font-bold text-stone-800">Total</span>
        <span className="text-base font-bold text-[var(--brand-primary)]">
          ₹{total.toLocaleString('en-IN')}
        </span>
      </div>
    </div>
  );
}