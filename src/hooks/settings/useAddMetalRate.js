import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { addMetalRate } from '@/services/settingsService';
import TOAST from '@/constants/toastMessages';
import tracker from '@/lib/analytics/tracker';
import EVENTS from '@/lib/analytics/events';

// FIXED 2026-08-27: this used to hardcode its own success/failure strings
// (close to, but not the same wording as, TOAST.METAL_RATES.ADDED/
// ADD_FAILED — the constants this app's toast messages are supposed to be
// centralized in), and unlike every other mutation hook in this codebase
// (see useTransactionMutations.js/useRepairMutations.js's identical
// getErrorMessage), it never surfaced OrnaVerse's own server reason on
// failure — always the same flat generic string, even when the server
// sent back something specific like "Rate for this metal/purity already
// exists today."
function getErrorMessage(error, fallback = TOAST.METAL_RATES.ADD_FAILED) {
  return (
    error?.response?.data?.Message ??
    error?.response?.data?.message ??
    error?.message ??
    fallback
  );
}

/**
 * Mutation hook for creating a metal rate entry.
 * Maps to: POST Services/Costing/MetalRates/Create
 */
export function useAddMetalRate({ onSuccess } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => addMetalRate(payload),
    onSuccess: (data, variables) => {
      // Every live price is computed from the metal rate, so a new rate makes
      // the cached ones wrong.
      //
      // Catalog prices are NOT invalidated directly — they are cached against
      // a pricing epoch and would only be refetched under the same (now
      // wrong) key. Invalidate the EPOCH instead: it re-prices its canaries,
      // sees the new figure, and every catalog price reprices as a
      // consequence. One small call decides it rather than a blind sweep.
      //
      // This is a shortcut for the in-app path only — it just saves waiting
      // out the epoch's one-minute re-check floor. Rates set in OrnaVerse's
      // ERP never reach this handler at all; the epoch is what catches those.
      //   ['catalog','price-epoch'] — canary fingerprint (usePricingEpoch)
      //   ['items','pricing']       — product detail / variant (useVariantPricing)
      queryClient.invalidateQueries({ queryKey: ['catalog', 'price-epoch'] });
      queryClient.invalidateQueries({ queryKey: ['items', 'pricing'] });

      toast.success(TOAST.METAL_RATES.ADDED);
      tracker.track(EVENTS.METAL_RATE_ADDED, {
        metalTypeId:  variables?.metal_type_id,
        purchaseRate: variables?.purchase_rate,
        salesRate:    variables?.sales_rate,
      });
      onSuccess?.();
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      toast.error(message);
      tracker.track(EVENTS.METAL_RATE_ADD_FAILED, { error: message });
    },
  });
}
