// src/hooks/buyback/useCreateBuyback.js
// Two-step flow: createBuyback() → postBuyback()
//
// BuyBackRow payload:
// {
//   party_id:      number,
//   company_id:    number,
//   document_date: string,
//   currency_id:   number,
//   line_items: [{
//     item_name:     string,   — description of jewellery being bought back
//     metal_type_id: number,
//     gross_weight:  number,
//     net_weight:    number,
//     purity:        number,
//     rate:          number,   — ₹ per gram
//     amount:        number,   — total payout for this item
//   }],
//   receipt_details: [{        — how store pays the customer
//     mode_id: number,
//     amount:  number,
//   }]
// }

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { createBuyback, postBuyback } from '@/services/buybackService';
import TOAST from '@/constants/toastMessages';

export function useCreateBuyback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (buybackEntity) => {
      const createRes = await createBuyback(buybackEntity);
      const transactionId = createRes?.EntityId;
      if (!transactionId) throw new Error('Buyback creation failed — no EntityId returned.');
      await postBuyback(transactionId);
      return { transactionId };
    },

    onSuccess: () => {
      toast.success(TOAST.BUYBACK.POSTED);
      queryClient.invalidateQueries({ queryKey: ['buyback'] });
    },

    onError: () => {
      toast.error(TOAST.BUYBACK.CREATE_FAILED);
    },
  });
}
