// src/hooks/orders/useCancelOrder.js
// Cancels a posted POS order via POS/Order/Cancel.
// On success: invalidates orders list cache and shows a toast.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { cancelOrder } from '@/services/orderService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import TOAST from '@/constants/toastMessages';

export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId) => cancelOrder(transactionId),

    onSuccess: () => {
      toast.success(TOAST.ORDERS.CANCELLED);
      // Invalidate orders list — use the base key to bust all parameterised variants
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },

    onError: () => {
      toast.error(TOAST.ORDERS.CANCEL_FAILED);
    },
  });
}