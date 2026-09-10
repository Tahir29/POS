// Computed cart totals: subtotal, discount, total. Reused by CartSummary
// across the checkout journey (Cart Drawer, Checkout, order review) — keep
// this the single source of truth for total math so those screens stay in sync.

import { useSelector } from 'react-redux';
import {
  selectCartSubtotal,
  selectCartDiscount,
  selectCartTax,
  selectCartTotal,
} from '@/store/slices/cartSlice';

export function useCartTotals() {
  const subtotal = useSelector(selectCartSubtotal);
  const discount = useSelector(selectCartDiscount);
  const tax      = useSelector(selectCartTax);
  const total    = useSelector(selectCartTotal);

  return { subtotal, discount, tax, total };
}