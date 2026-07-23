// src/hooks/orders/useCancelOrder.js
// Cancels a posted POS order via POS/Order/Cancel.
// On success: invalidates orders list cache and shows a toast.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { cancelOrder } from '@/services/orderService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import TOAST from '@/constants/toastMessages';
import tracker from '@/lib/analytics/tracker';
import EVENTS from '@/lib/analytics/events';

export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId) => cancelOrder(transactionId),

    onSuccess: (_data, transactionId) => {
      toast.success(TOAST.ORDERS.CANCELLED);
      tracker.track(EVENTS.ORDER_CANCELLED, { transactionId });
      // Invalidate orders list — use the base key to bust all parameterised variants
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },

    onError: (error, transactionId) => {
      toast.error(TOAST.ORDERS.CANCEL_FAILED);
      tracker.track(EVENTS.ORDER_CANCEL_FAILED, {
        transactionId,
        error: error?.message ?? 'unknown',
      });
    },
  });
}