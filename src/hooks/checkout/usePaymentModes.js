// src/hooks/checkout/usePaymentModes.js
// Fetch available payment modes for checkout.
// Cached for STALE_TIME.STATIC (30 min) — payment modes rarely change.
//
// FILTER RULES (see APP_CONFIG.PAYMENT_MODES for rationale):
//   SHOW if: only_for_pos === true OR mode_code in ALLOWLIST
//   HIDE if: mode_code in DENYLIST
//
// Confirmed PaymentReceiptModeRow fields (v1.json):
//   mode_id, mode_code, mode_name, only_for_pos,
//   is_disabled, allow_selection, is_pos_machine

import { useQuery } from '@tanstack/react-query';
import { getPaymentModes } from '@/services/settingsService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

function normalizeMode(entity) {
  return {
    modeId:       entity.mode_id,
    modeCode:     entity.mode_code   ?? null,
    modeName:     entity.mode_name && entity.mode_name !== 'NA' ? entity.mode_name : 'Unknown',
    onlyForPos:   entity.only_for_pos  ?? false,
    allowSelection:entity.allow_selection ?? true,
    isPosMachine: entity.is_pos_machine  ?? false,  // bank POS terminal
    isDisabled:   entity.is_disabled     ?? false,
    raw:          entity,
  };
}

function isPosPaymentMode(mode) {
  if (mode.isDisabled) return false;
  const { ALLOWLIST, DENYLIST } = APP_CONFIG.PAYMENT_MODES;
  if (DENYLIST.includes(mode.modeCode)) return false;
  return mode.onlyForPos === true || ALLOWLIST.includes(mode.modeCode);
}

export function usePaymentModes() {
  const query = useQuery({
    queryKey: QUERY_KEYS.SETTINGS.PAYMENT_MODES(),
    queryFn:  async () => {
      // getPaymentModes returns response.data (service unwraps)
      const data     = await getPaymentModes();
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