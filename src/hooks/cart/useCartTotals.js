// src/hooks/cart/useCartTotals.js
// Computed cart totals: subtotal, discount, total.
// Reused by CartSummary — which itself is reused across the checkout
// journey (Cart Drawer in Phase 8, Checkout screen in Phase 9, and any
// order review/confirmation step). Keep this hook the single source of
// truth for total math so all those screens stay in sync.

import { useSelector } from 'react-redux';
import {
  selectCartSubtotal,
  selectCartDiscount,
  selectCartTotal,
} from '@/store/slices/cartSlice';

export function useCartTotals() {
  const subtotal = useSelector(selectCartSubtotal);
  const discount = useSelector(selectCartDiscount);
  const total    = useSelector(selectCartTotal);

  return { subtotal, discount, total };
}