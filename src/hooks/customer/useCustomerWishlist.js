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

async function fetchWishlist(partyId, token) {
  const res = await fetch(`/api/customers/wishlist?party_id=${partyId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Wishlist fetch failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.items) ? data.items : [];
}

/**
 * @param {number|string|null} partyId
 */
export function useCustomerWishlist(partyId) {
  const token = useSelector(selectAccessToken);
  const id = partyId ? Number(partyId) : null;

  const query = useQuery({
    queryKey:  QUERY_KEYS.CUSTOMERS.WISHLIST(id),
    queryFn:   () => fetchWishlist(id, token),
    enabled:   !!id && !!token,
    staleTime: 60 * 1000,
  });

  return {
    items:     query.data ?? [],
    isLoading: query.isLoading,
    isError:   query.isError,
  };
}
