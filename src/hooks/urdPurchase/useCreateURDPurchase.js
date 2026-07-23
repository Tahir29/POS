// src/hooks/urdPurchase/useCreateURDPurchase.js
// Two-step flow: createURDPurchase() → postURDPurchase()
//
// URDPurchaseRow payload:
// {
//   party_id:      number,
//   company_id:    number,
//   document_date: string,
//   currency_id:   number,
//   line_items: [{
//     metal_type_id: number,
//     weight:        number,   — total weight in grams
//     purity:        number,   — e.g. 999 for 24k raw gold
//     rate:          number,   — ₹ per gram
//     amount:        number,   — weight * (purity/1000) * rate
//   }],
//   receipt_details: [{        — how store pays the customer/dealer
//     mode_id: number,
//     amount:  number,
//   }]
// }

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { createURDPurchase, postURDPurchase } from '@/services/urdPurchaseService';
import TOAST from '@/constants/toastMessages';
import tracker from '@/lib/analytics/tracker';
import EVENTS from '@/lib/analytics/events';

export function useCreateURDPurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (urdEntity) => {
      const createRes = await createURDPurchase(urdEntity);
      const transactionId = createRes?.EntityId;
      if (!transactionId) throw new Error('URD Purchase creation failed — no EntityId returned.');
      await postURDPurchase(transactionId);
      return { transactionId };
    },

    onSuccess: (data) => {
      toast.success(TOAST.URD_PURCHASE.POSTED);
      tracker.track(EVENTS.URD_PURCHASE_POSTED, { transactionId: data?.transactionId });
      queryClient.invalidateQueries({ queryKey: ['urd-purchase'] });
    },

    onError: (error) => {
      toast.error(TOAST.URD_PURCHASE.CREATE_FAILED);
      tracker.track(EVENTS.URD_PURCHASE_FAILED, { error: error?.message ?? 'unknown' });
    },
  });
}
