// src/hooks/checkout/usePaymentModes.js
// Fetch available payment modes — Phase 9b (Checkout).
// Cached with a long stale time (30 min) — payment modes rarely change.
// None are hardcoded; sourced entirely from PaymentReceiptMode/List, then
// filtered down to POS-relevant customer payment modes — see
// APP_CONFIG.PAYMENT_MODES for the filter rules.

import { useQuery } from '@tanstack/react-query';
import { getPaymentModes } from '@/services/settingsService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

/**
 * Normalizes an OrnaVerse payment mode record, treating "NA" as empty.
 */
function normalizeMode(entity) {
  return {
    modeId:   entity.mode_id,
    modeCode: entity.mode_code ?? null,
    modeName: entity.mode_name && entity.mode_name !== 'NA' ? entity.mode_name : 'Unknown',
    modeType: entity.mode_type ?? null,
    onlyForPos: entity.only_for_pos ?? false,
    raw:      entity,
  };
}

/**
 * A mode is shown at checkout if:
 *   only_for_pos === true  OR  mode_code is in ALLOWLIST
 * ...and mode_code is NOT in DENYLIST.
 * See APP_CONFIG.PAYMENT_MODES for rationale.
 */
function isPosPaymentMode(mode) {
  const { ALLOWLIST, DENYLIST } = APP_CONFIG.PAYMENT_MODES;

  if (DENYLIST.includes(mode.modeCode)) return false;

  return mode.onlyForPos === true || ALLOWLIST.includes(mode.modeCode);
}

export function usePaymentModes() {
  const query = useQuery({
    queryKey: QUERY_KEYS.SETTINGS.PAYMENT_MODES(),
    queryFn: async () => {
      const data = await getPaymentModes();
      const entities = data?.Entities ?? [];
      return entities.map(normalizeMode).filter(isPosPaymentMode);
    },
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
  });

  return {
    paymentModes: query.data ?? [],
    isLoading:    query.isLoading,
    isError:      query.isError,
    refetch:      query.refetch,
  };
}