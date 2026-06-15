'use client';

// src/components/features/customers/CustomerDetailSheet/index.jsx
// Read-only detail view for a customer selected from the directory
// (/customers page), with an "Attach to Cart" action.
//
// NOTE: No customer-update endpoint exists in API_MAPPING.md (only
// Customer/Generate for creation) — so this is read-only. "Edit" was
// requested but isn't supported by the current API surface; flagged
// as a blocker for the OrnaVerse team.

import { Mail, Phone, MapPin, CreditCard } from 'lucide-react';
import BottomSheet from '@/components/shared/BottomSheet';
import { Button } from '@/components/ui/button';

/**
 * @param {{
 *   customer: { customerId, customerName, customerMobile, customerEmail, customerAddress, raw } | null,
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onAttach: () => void,
 *   isAttached: boolean,
 * }} props
 */
export default function CustomerDetailSheet({ customer, isOpen, onClose, onAttach, isAttached }) {
  if (!customer) return null;

  const { customerName, customerMobile, customerEmail, customerAddress, raw } = customer;
  const partyCode = raw?.party_code && raw.party_code !== 'NA' ? raw.party_code : null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={customerName || 'Customer'}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 text-sm">
          {customerMobile && (
            <div className="flex items-center gap-2 text-stone-600">
              <Phone size={15} aria-hidden="true" className="shrink-0 text-stone-400" />
              {customerMobile}
            </div>
          )}
          {customerEmail && (
            <div className="flex items-center gap-2 text-stone-600">
              <Mail size={15} aria-hidden="true" className="shrink-0 text-stone-400" />
              <span className="truncate">{customerEmail}</span>
            </div>
          )}
          {customerAddress && (customerAddress.address || customerAddress.city) && (
            <div className="flex items-start gap-2 text-stone-600">
              <MapPin size={15} aria-hidden="true" className="shrink-0 text-stone-400 mt-0.5" />
              <span>
                {[customerAddress.address, customerAddress.city, customerAddress.state, customerAddress.zip]
                  .filter(Boolean)
                  .join(', ')}
              </span>
            </div>
          )}
          {partyCode && (
            <div className="flex items-center gap-2 text-stone-600">
              <CreditCard size={15} aria-hidden="true" className="shrink-0 text-stone-400" />
              Customer code: {partyCode}
            </div>
          )}
        </div>

        <Button
          type="button"
          onClick={onAttach}
          disabled={isAttached}
          className="h-12 w-full text-base font-semibold"
        >
          {isAttached ? 'Already attached to cart' : 'Attach to Cart'}
        </Button>
      </div>
    </BottomSheet>
  );
}