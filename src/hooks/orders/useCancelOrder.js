import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { cancelOrder } from '@/services/orderService';
import { useSessionTrackingContext } from '@/hooks/analytics/useSessionTrackingContext';
import { QUERY_KEYS } from '@/constants/queryKeys';
import TOAST from '@/constants/toastMessages';
import tracker from '@/lib/analytics/tracker';
import EVENTS from '@/lib/analytics/events';

// ENRICHED 2026-09-04 — customer_id/store_id were entirely absent from both
// events (same fix as useTransactionMutations.js). Cancelling an order is
// keyed only on transactionId, with no fuller payload on hand, so the
// session-derived customer/store is the only extra context available here.
export function useCancelOrder() {
  const queryClient = useQueryClient();
  const sessionCtx = useSessionTrackingContext();

  return useMutation({
    mutationFn: (transactionId) => cancelOrder(transactionId),

    onSuccess: (_data, transactionId) => {
      toast.success(TOAST.ORDERS.CANCELLED);
      tracker.track(EVENTS.ORDER_CANCELLED, { transactionId, ...sessionCtx });
      // Invalidate orders list — use the base key to bust all parameterised variants
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },

    onError: (error, transactionId) => {
      toast.error(TOAST.ORDERS.CANCEL_FAILED);
      tracker.track(EVENTS.ORDER_CANCEL_FAILED, {
        transactionId,
        error: error?.message ?? 'unknown',
        ...sessionCtx,
      });
    },
  });
}