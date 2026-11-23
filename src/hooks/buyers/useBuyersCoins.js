import { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getLoyaltyCheckoutSettings, previewLoyaltyCheckout } from '@/services/nectorService';
import { isThirdPartyLoyalty } from '@/lib/checkout/loyaltyEligibility';
import { createConcurrencyQueue } from '@/lib/concurrencyQueue';
import { QUERY_KEYS } from '@/constants/queryKeys';

const PROBE_AMOUNT = 1000000;
// Bounded queue of 4 concurrent requests to fetch live points safely without overloading OrnaVerse
const previewQueue = createConcurrencyQueue(previewLoyaltyCheckout, { concurrency: 4 });

/**
 * Fetches live Lucira points for a list of buyers at a store on-demand (for sorting).
 * Always pulls fresh balances from OrnaVerse without requiring a hard page refresh (F5).
 * Zero persistence to MongoDB as requested.
 */
export function useBuyersCoins({ buyers = [], companyId, enabled = true, refreshKey = 0 }) {
  const queryClient = useQueryClient();
  const [coinsMap, setCoinsMap] = useState(() => new Map());
  const [isLoadingCoins, setIsLoadingCoins] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });

  const settingsQuery = useQuery({
    queryKey: QUERY_KEYS.NECTOR.LOYALTY_CHECKOUT_SETTINGS(companyId),
    queryFn: () => getLoyaltyCheckoutSettings(companyId),
    enabled: enabled && !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const settings = settingsQuery.data;
  const isLoyaltyReady = enabled && !!companyId && isThirdPartyLoyalty(settings);
  const itemGroup = settings?.item_groups?.[0] ?? null;

  // Stable key representing buyer IDs to avoid re-triggering when object references change
  const buyerKeys = useMemo(
    () => buyers.map((b) => `${b._id}:${b.customerMobile ?? ''}`).join('|'),
    [buyers],
  );

  const runIdRef = useRef(0);

  useEffect(() => {
    if (!isLoyaltyReady || !buyers.length) {
      setIsLoadingCoins(false);
      return;
    }

    const eligible = buyers.filter((b) => b._id && b.customerMobile);
    if (!eligible.length) {
      setIsLoadingCoins(false);
      return;
    }

    const currentRunId = ++runIdRef.current;
    let loaded = 0;
    const total = eligible.length;
    setProgress({ loaded: 0, total });
    setIsLoadingCoins(true);

    // Pre-seed with any existing data in cache so UI does not show blanks while updating
    const newMap = new Map();
    for (const buyer of eligible) {
      const partyId = Number(buyer._id);
      const cacheKey = ['nector', 'points-balance', companyId, partyId];
      const cached = queryClient.getQueryData(cacheKey);
      if (cached !== undefined) {
        newMap.set(partyId, cached?.success ? Number(cached.coin_value) || 0 : 0);
      }
    }
    if (newMap.size > 0) {
      setCoinsMap(new Map(newMap));
    }

    let isCancelled = false;

    // Always fetch fresh live balances from OrnaVerse
    Promise.allSettled(
      eligible.map(async (buyer) => {
        const partyId = Number(buyer._id);
        const mobile = buyer.customerMobile;
        const cacheKey = ['nector', 'points-balance', companyId, partyId];

        try {
          const res = await previewQueue({
            companyId,
            partyId,
            mobile,
            cartAmount: PROBE_AMOUNT,
            applyCoins: true,
            applyCredits: false,
            netAmount: PROBE_AMOUNT,
            remainingDue: PROBE_AMOUNT,
            lines: itemGroup != null ? [{ item_group_id: itemGroup, taxable_amount: PROBE_AMOUNT }] : [],
          });
          queryClient.setQueryData(cacheKey, res);
          const pts = res?.success ? Number(res.coin_value) || 0 : 0;
          if (!isCancelled && runIdRef.current === currentRunId) {
            newMap.set(partyId, pts);
            loaded++;
            setCoinsMap(new Map(newMap));
            setProgress({ loaded, total });
          }
        } catch {
          if (!isCancelled && runIdRef.current === currentRunId) {
            newMap.set(partyId, newMap.get(partyId) ?? 0);
            loaded++;
            setCoinsMap(new Map(newMap));
            setProgress({ loaded, total });
          }
        }
      }),
    ).finally(() => {
      if (!isCancelled && runIdRef.current === currentRunId) {
        setIsLoadingCoins(false);
      }
    });

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoyaltyReady, companyId, buyerKeys, refreshKey]);

  return {
    coinsMap,
    isLoadingCoins: (enabled && settingsQuery.isLoading) || isLoadingCoins,
    progress,
  };
}
