// src/hooks/checkout/useExchangeRate.js
// Fetches the currency exchange_rate required on Order/Invoice Create
// alongside currency_id. Confirmed via direct UAT test 2026-07-16:
// currency_id 103 (INR) returns exchange_rate: 1 — fetched live rather than
// hardcoded in case a store ever trades in a different base currency.

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getExchangeRate } from '@/services/settingsService';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

export function useExchangeRate(currencyId = APP_CONFIG.CURRENCY.INR_ID) {
  const companyId = useSelector(selectActiveStoreId);

  const query = useQuery({
    queryKey: QUERY_KEYS.EXCHANGE_RATE.GET(currencyId, companyId),
    queryFn: async () => {
      const response = await getExchangeRate({ currency_id: currencyId, company_id: companyId });
      return response?.Entity?.exchange_rate ?? 1;
    },
    enabled:   !!companyId,
    staleTime: APP_CONFIG.STALE_TIME.STATIC,
  });

  return {
    // Safe default — matches the confirmed INR rate — so checkout isn't
    // blocked if this call is slow/fails; server will reject bad data anyway.
    exchangeRate: query.data ?? 1,
    isLoading:    query.isLoading,
  };
}
