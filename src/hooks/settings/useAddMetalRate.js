// src/hooks/settings/useAddMetalRate.js
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { addMetalRate } from '@/services/settingsService';

/**
 * Mutation hook for creating a metal rate entry.
 * Maps to: POST Services/Costing/MetalRates/Create
 */
export function useAddMetalRate({ onSuccess } = {}) {
  return useMutation({
    mutationFn: (payload) => addMetalRate(payload),
    onSuccess: () => {
      toast.success('Metal rate saved successfully.');
      onSuccess?.();
    },
    onError: () => {
      toast.error('Failed to save metal rate. Please try again.');
    },
  });
}