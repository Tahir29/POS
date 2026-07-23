// src/hooks/returns/useCreateReturn.js
// Two-step return flow: createReturn() → postReturn()
// Both steps are chained in a single mutation so the UI only needs one call.
// On success: invalidates returns + orders caches.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { createReturn, postReturn } from '@/services/returnService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import TOAST from '@/constants/toastMessages';
import tracker from '@/lib/analytics/tracker';
import EVENTS from '@/lib/analytics/events';

/**
 * Payload shape expected by mutateAsync():
 * {
 *   party_id:            number,   — customer party_id
 *   company_id:          number,   — active store ID
 *   document_date:       string,   — ISO date string
 *   currency_id:         number,   — e.g. 103 for INR
 *   ref_transaction_id:  number,   — original invoice transaction_id
 *   line_items: [{
 *     item_id:   number,
 *     pieces:    number,
 *     item_rate: number,
 *     net_amount:number,
 *   }],
 *   receipt_details: [{            — how refund is paid back
 *     mode_id:  number,
 *     amount:   number,
 *   }],
 * }
 */
export function useCreateReturn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (returnEntity) => {
      // Step 1: Create draft
      const createRes = await createReturn(returnEntity);
      const transactionId = createRes?.EntityId;
      if (!transactionId) throw new Error('Return creation failed — no EntityId returned.');

      // Step 2: Post (finalise) — triggers stock credit + refund accounting
      await postReturn(transactionId);
      return { transactionId };
    },

    onSuccess: (data) => {
      toast.success(TOAST.RETURNS.POST_SUCCESS);
      tracker.track(EVENTS.RETURN_POSTED, { transactionId: data?.transactionId });
      // Bust returns list and orders list (return affects order status display)
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },

    onError: (error) => {
      toast.error(TOAST.RETURNS.CREATE_FAILED);
      tracker.track(EVENTS.RETURN_FAILED, { error: error?.message ?? 'unknown' });
    },
  });
}