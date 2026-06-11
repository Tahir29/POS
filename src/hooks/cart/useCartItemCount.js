// src/hooks/cart/useCartItemCount.js
// Total item count (sum of quantities) for the header cart badge.

import { useSelector } from 'react-redux';
import { selectCartItemCount } from '@/store/slices/cartSlice';

export function useCartItemCount() {
  return useSelector(selectCartItemCount);
}