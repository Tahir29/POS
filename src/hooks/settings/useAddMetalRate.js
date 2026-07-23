// src/hooks/settings/useAddMetalRate.js
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { addMetalRate } from '@/services/settingsService';
import tracker from '@/lib/analytics/tracker';
import EVENTS from '@/lib/analytics/events';

/**
 * Mutation hook for creating a metal rate entry.
 * Maps to: POST Services/Costing/MetalRates/Create
 */
export function useAddMetalRate({ onSuccess } = {}) {
  return useMutation({
    mutationFn: (payload) => addMetalRate(payload),
    onSuccess: (data, variables) => {
      toast.success('Metal rate saved successfully.');
      tracker.track(EVENTS.METAL_RATE_ADDED, {
        metalTypeId:  variables?.metal_type_id,
        purchaseRate: variables?.purchase_rate,
        salesRate:    variables?.sales_rate,
      });
      onSuccess?.();
    },
    onError: (error) => {
      toast.error('Failed to save metal rate. Please try again.');
      tracker.track(EVENTS.METAL_RATE_ADD_FAILED, { error: error?.message ?? 'unknown' });
    },
  });
}