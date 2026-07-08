// src/hooks/customer/useCreateCustomer.js
// Create a new customer via POS/Customer/Create.
//
// EXISTENCE CHECK: Before creating, checks if a customer with the same
// mobile already exists via GetCustomer. If found, returns the existing
// customer instead of creating a duplicate — matching the behavior of
// CustomerSessionSheet which does lookup first.
//
// Response is SaveResponse: { EntityId, Error, CustomData }

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { createCustomer, getCustomer } from '@/services/customerService';
import { buildCustomerCreatePayload, normalizeCustomer } from '@/lib/normalizers/customer';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import TOAST from '@/constants/toastMessages';

export function useCreateCustomer() {
  const queryClient   = useQueryClient();
  const activeStoreId = useSelector(selectActiveStoreId);

  const mutation = useMutation({
    mutationFn: async (formValues) => {
      // ── Step 1: Check if customer already exists by mobile ──────────────
      try {
        const lookupResponse = await getCustomer(formValues.mobile);
        const existing = lookupResponse?.data?.Entities?.[0] ?? null;
        if (existing) {
          // Return existing customer — skip creation
          return { _existing: true, customer: normalizeCustomer(existing) };
        }
      } catch {
        // Lookup failed — proceed to create (fail-open, not fail-closed)
      }

      // ── Step 2: Create new customer ──────────────────────────────────────
      const entity = buildCustomerCreatePayload({
        ...formValues,
        company_id: activeStoreId,
      });
      const response = await createCustomer(entity);
      return { _existing: false, response };
    },

    onSuccess: (result, formValues) => {
      const customerName   = formValues.party_name;
      const customerMobile = formValues.mobile;

      if (result._existing) {
        // Customer already exists — inform the user
        toast.info(`Customer ${customerName} already exists. Using existing record.`);
      } else {
        // New customer created
        const customerId = result.response?.data?.EntityId;
        toast.success(TOAST.CUSTOMER.CREATED(customerName));

        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.CUSTOMERS.LOOKUP(customerMobile),
        });
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      }
    },

    onError: () => {
      toast.error(TOAST.CUSTOMER.CREATE_FAILED);
    },
  });

  // Wrap mutateAsync to always return { customerId, customerName, customerMobile }
  const wrappedMutation = {
    ...mutation,
    mutateAsync: async (formValues) => {
      const result = await mutation.mutateAsync(formValues);

      if (result._existing) {
        return {
          customerId:     result.customer.customerId,
          customerName:   result.customer.customerName,
          customerMobile: result.customer.customerMobile,
          _existing:      true,
        };
      }

      return {
        customerId:     result.response?.data?.EntityId,
        customerName:   formValues.party_name,
        customerMobile: formValues.mobile,
        _existing:      false,
      };
    },
  };

  return wrappedMutation;
}