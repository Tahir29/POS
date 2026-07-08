// src/hooks/dailyClosing/useCreateDailyClosing.js
// Creates and finalises a daily closing entry.
// No Post step — Create is terminal per API design.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { createDailyClosing } from '@/services/dailyClosingService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import TOAST from '@/constants/toastMessages';

export function useCreateDailyClosing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (closingEntity) => createDailyClosing(closingEntity),

    onSuccess: (_, variables) => {
      toast.success(TOAST.DAILY_CLOSING.CREATED);
      // Bust the closing list for this store
      queryClient.invalidateQueries({ queryKey: ['daily-closing'] });
    },

    onError: () => {
      toast.error(TOAST.DAILY_CLOSING.CREATE_FAILED);
    },
  });
}
