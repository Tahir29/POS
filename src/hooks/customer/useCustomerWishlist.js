// Read-only wishlist fetch for the customer profile page's Wishlist tab —
// deliberately independent of wishlistSlice/wishlistMiddleware, which only
// ever describe whichever customer is currently ATTACHED to the POS
// session. An operator viewing a customer's full profile is very often
// looking someone up who ISN'T (or no longer is) attached, so this hook
// fetches by party_id directly rather than reading Redux.

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { selectAccessToken } from '@/store/slices/authSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';

// FIXED 2026-09-09 — customerMobile added alongside party_id. See
// lib/mongo/wishlist.js's buildFilter: party_id is assigned per OrnaVerse
// TENANT (UAT vs LIVE are separate tenants), so a wishlist saved via
// wishlistMiddleware while attached under one environment could silently
// fail to appear here under the other if this only ever queried by
// party_id — same root cause as the abandoned-cart restore bug this fix
// traces back to.
async function fetchWishlist(partyId, customerMobile, token) {
  const params = new URLSearchParams();
  if (partyId != null) params.set('party_id', String(partyId));
  if (customerMobile) params.set('customer_mobile', customerMobile);
  const res = await fetch(`/api/customers/wishlist?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Wishlist fetch failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.items) ? data.items : [];
}

/**
 * @param {number|string|null} partyId
 * @param {string|null} [customerMobile] — this profile's own mobile number,
 *   the real lookup key now (see fetchWishlist's comment); optional only
 *   for backward compatibility with any caller that hasn't been updated to
 *   pass it — falls back to party_id-only lookup in that case.
 */
export function useCustomerWishlist(partyId, customerMobile = null) {
  const token = useSelector(selectAccessToken);
  const id = partyId ? Number(partyId) : null;

  const query = useQuery({
    queryKey:  QUERY_KEYS.CUSTOMERS.WISHLIST(id),
    queryFn:   () => fetchWishlist(id, customerMobile, token),
    enabled:   !!id && !!token,
    staleTime: 60 * 1000,
  });

  return {
    items:     query.data ?? [],
    isLoading: query.isLoading,
    isError:   query.isError,
  };
}
