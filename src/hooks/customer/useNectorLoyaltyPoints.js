// src/hooks/customer/useNectorLoyaltyPoints.js
//
// A customer's Nector loyalty points balance, looked up by mobile number.
// See services/nectorService.js's getCustomerLoyalty for the confirmed-live
// endpoint/response shape and services/apiEndpoints route.js's own header
// for the full Nector "leads" API writeup.
//
// Distinct from useCustomerLoyalty (OrnaVerse's own native CRM rewards
// system, Services/CRM/CustomerRewards/*) — this is a SEPARATE loyalty
// program (Nector, tied to the Shopify storefront) this app also reads.
// Deliberately not merged into that hook: two unrelated point balances
// from two unrelated systems, and conflating them would misrepresent
// which program a given balance actually belongs to.

import { useQuery } from '@tanstack/react-query';
import { getCustomerLoyalty } from '@/services/nectorService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {string|number|null|undefined} mobile — real, unmasked mobile
 *   number. Pass useCustomerSession().customerMobile — already the right
 *   shape, no normalization needed.
 * @param {{ enabled?: boolean }} [options]
 * @returns {{
 *   points: number, tier: string|null, name: string|null,
 *   isFound: boolean, isLoading: boolean, isError: boolean,
 * }}
 *   isFound distinguishes "this customer has no Nector lead at all" (a
 *   normal outcome — most in-store-only customers never interact with the
 *   Shopify storefront) from "we don't know yet" (isLoading) — a caller
 *   can show "Not enrolled" instead of a 0 that reads like an empty wallet.
 */
export function useNectorLoyaltyPoints(mobile, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: QUERY_KEYS.NECTOR.LOYALTY(mobile),
    queryFn:  () => getCustomerLoyalty(mobile),
    enabled:  enabled && !!mobile,
    staleTime: APP_CONFIG.STALE_TIME.CUSTOMER,
    // getCustomerLoyalty() never throws (see its own header) — nothing to
    // retry against a real error, only a slow network hiccup, which
    // TanStack's own default retry already covers.
  });

  return {
    points:    query.data?.points ?? 0,
    tier:      query.data?.tier ?? null,
    name:      query.data?.name ?? null,
    isFound:   query.data?.found ?? false,
    isLoading: query.isLoading,
    isError:   query.isError,
  };
}
