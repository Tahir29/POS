// src/hooks/schemes/useEnrollCustomer.js
// Enroll the attached customer into a jewellery savings scheme.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { createSchemeEnrollment } from '@/services/schemeService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import TOAST from '@/constants/toastMessages';

export function useEnrollCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => createSchemeEnrollment(payload),

    onSuccess: () => {
      toast.success(TOAST.SCHEMES.ENROLLED);
      // Bust all enrollment caches — storeId-scoped and customer-scoped
      queryClient.invalidateQueries({ queryKey: ['schemes'] });
    },

    onError: () => {
      toast.error(TOAST.SCHEMES.ENROLL_FAILED);
    },
  });
}
