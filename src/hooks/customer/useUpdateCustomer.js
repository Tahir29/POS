// src/hooks/customer/useUpdateCustomer.js
// Update an existing customer via POS/Customer/Update.
//
// IMPORTANT: OrnaVerse requires the FULL CustomerRow on update.
// Always: retrieveCustomer() → merge changes → updateCustomer()
// Never send partial updates — missing fields will be cleared.
// buildCustomerUpdatePayload() in normalizers/customer.js handles this merge.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { updateCustomer } from '@/services/customerService';
import { buildCustomerUpdatePayload } from '@/lib/normalizers/customer';
import { normalizeCustomer } from '@/lib/normalizers/customer';
import { QUERY_KEYS } from '@/constants/queryKeys';
import TOAST from '@/constants/toastMessages';

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    /**
     * @param {{
     *   partyId:     number,
     *   originalRaw: object,   — raw entity from Customer/Retrieve
     *   formChanges: object,   — only the changed fields from the edit form
     * }} params
     */
    mutationFn: ({ partyId, originalRaw, formChanges }) => {
      const mergedEntity = buildCustomerUpdatePayload(originalRaw, formChanges);
      return updateCustomer(partyId, mergedEntity);
    },

    onSuccess: (response, { partyId, formChanges }) => {
      const customerName = formChanges.party_name;
      toast.success(TOAST.CUSTOMER.UPDATED(customerName));

      // Invalidate all caches that may hold stale customer data
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CUSTOMERS.RETRIEVE(partyId) });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },

    onError: () => {
      toast.error(TOAST.CUSTOMER.UPDATE_FAILED);
    },
  });

  return mutation;
}