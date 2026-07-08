// src/hooks/schemes/useSchemeReceipt.js
// Record a monthly scheme instalment payment from a customer.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { createSchemeReceipt } from '@/services/schemeService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import TOAST from '@/constants/toastMessages';

export function useSchemeReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => createSchemeReceipt(payload),

    onSuccess: (_, variables) => {
      toast.success(TOAST.SCHEMES.RECEIPT_SUCCESS);
      // Bust receipts for this enrollment + enrollment list
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.SCHEMES.RECEIPT_LIST(variables.scheme_enrollment_id),
      });
      queryClient.invalidateQueries({ queryKey: ['schemes'] });
    },

    onError: () => {
      toast.error(TOAST.SCHEMES.RECEIPT_FAILED);
    },
  });
}
