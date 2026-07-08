// src/hooks/exchange/useCreateExchange.js
// Two-step exchange flow: createExchange() → postExchange()
// Chained in one mutation so UI only needs one call.
//
// ExchangeRow payload shape:
// {
//   party_id:      number,
//   company_id:    number,
//   document_date: string,
//   currency_id:   number,
//   line_items: [{
//     item_name:      string,   — description of old item being exchanged in
//     metal_type_id:  number,   — gold/silver/platinum
//     gross_weight:   number,   — grams
//     net_weight:     number,
//     purity:         number,   — e.g. 750 for 18k
//     rate:           number,   — per gram rate
//     exchange_value: number,   — computed exchange credit
//   }]
// }

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { createExchange, postExchange } from '@/services/exchangeService';
import TOAST from '@/constants/toastMessages';

export function useCreateExchange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (exchangeEntity) => {
      const createRes = await createExchange(exchangeEntity);
      const transactionId = createRes?.EntityId;
      if (!transactionId) throw new Error('Exchange creation failed — no EntityId returned.');
      await postExchange(transactionId);
      return { transactionId };
    },

    onSuccess: () => {
      toast.success(TOAST.EXCHANGE.POSTED);
      queryClient.invalidateQueries({ queryKey: ['exchange'] });
      // Exchange value feeds into invoice helpers — bust invoice helper cache too
      queryClient.invalidateQueries({ queryKey: ['invoice-helpers'] });
    },

    onError: () => {
      toast.error(TOAST.EXCHANGE.CREATE_FAILED);
    },
  });
}
