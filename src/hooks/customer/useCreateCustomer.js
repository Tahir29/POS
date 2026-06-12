// src/hooks/customer/useCreateCustomer.js
// New customer creation mutation — Phase 9a (Customer Session).
// Response is { EntityId, Error, CustomData } — no echoed customer fields,
// so customerName/customerMobile are taken from the submitted form values.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { createCustomer } from '@/services/customerService';
import TOAST from '@/constants/toastMessages';
import { QUERY_KEYS } from '@/constants/queryKeys';

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (payload) => createCustomer(payload),
    onSuccess: (response, payload) => {
      const customerId = response?.data?.EntityId;
      const customerName = `${payload.first_name} ${payload.last_name}`.trim();
      const customerMobile = payload.phone;

      toast.success(TOAST.CUSTOMER.CREATED(customerName));

      // Invalidate any prior lookup for this mobile so future searches
      // reflect the newly created customer.
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.CUSTOMERS.LOOKUP(customerMobile),
      });

      return { customerId, customerName, customerMobile };
    },
    onError: () => {
      toast.error(TOAST.CUSTOMER.CREATE_FAILED);
    },
  });

  return mutation;
}