// src/hooks/customer/useCustomerWishlist.js
// Read-only wishlist fetch for the customer profile page's Wishlist tab —
// deliberately independent of wishlistSlice/wishlistMiddleware (which only
// track whichever customer is currently attached to the POS session), since
// a profile view is often for a customer who isn't currently attached.

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';

// Queries by customerMobile alongside party_id — party_id is assigned per
// OrnaVerse tenant (UAT vs LIVE), so a party_id-only lookup can miss a
// wishlist saved under a different tenant for the same real customer.
// Same-origin call — the operator's session cookie rides along automatically.
async function fetchWishlist(partyId, customerMobile) {
  const params = new URLSearchParams();
  if (partyId != null) params.set('party_id', String(partyId));
  if (customerMobile) params.set('customer_mobile', customerMobile);
  const res = await fetch(`/api/customers/wishlist?${params.toString()}`);
  if (!res.ok) throw new Error(`Wishlist fetch failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.items) ? data.items : [];
}

/**
 * @param {number|string|null} partyId
 * @param {string|null} [customerMobile] — this profile's own mobile number;
 *   optional for backward compatibility — falls back to party_id-only lookup.
 */
export function useCustomerWishlist(partyId, customerMobile = null) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const id = partyId ? Number(partyId) : null;

  const query = useQuery({
    queryKey:  QUERY_KEYS.CUSTOMERS.WISHLIST(id),
    queryFn:   () => fetchWishlist(id, customerMobile),
    enabled:   !!id && isAuthenticated,
    staleTime: 60 * 1000,
  });

  return {
    items:     query.data ?? [],
    isLoading: query.isLoading,
    isError:   query.isError,
  };
}
