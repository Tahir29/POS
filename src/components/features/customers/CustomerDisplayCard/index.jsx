'use client';

// src/components/features/customer/CustomerDisplayCard/index.jsx
// Shows a found/attached customer's details with a detach action.
// Reads `raw` (full OrnaVerse record) for address info if available.

import { User, Mail, Phone, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * @param {{
 *   customer: {
 *     customerId: number,
 *     customerName: string,
 *     customerMobile: string,
 *     raw?: object,
 *   },
 *   onDetach?: () => void,
 *   detachLabel?: string,
 * }} props
 */
export default function CustomerDisplayCard({ customer, onDetach, detachLabel = 'Remove' }) {
  if (!customer) return null;

  const { customerName, customerMobile, raw } = customer;
  const email = raw?.email && raw.email !== 'NA' ? raw.email : null;
  const address = raw?.party_address?.[0] ?? null;

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-brand-cream text-primary">
            <User size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-stone-800 truncate">{customerName}</p>
            {customerMobile && (
              <p className="flex items-center gap-1.5 text-sm text-stone-500 mt-0.5">
                <Phone size={13} aria-hidden="true" />
                {customerMobile}
              </p>
            )}
            {email && (
              <p className="flex items-center gap-1.5 text-sm text-stone-500 mt-0.5 truncate">
                <Mail size={13} aria-hidden="true" className="shrink-0" />
                <span className="truncate">{email}</span>
              </p>
            )}
            {address && (
              <p className="flex items-center gap-1.5 text-sm text-stone-500 mt-0.5">
                <MapPin size={13} aria-hidden="true" className="shrink-0" />
                {[address.city, address.state].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        </div>

        {onDetach && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDetach}
            aria-label={`${detachLabel} ${customerName}`}
            className="shrink-0 min-h-[44px] min-w-[44px] text-stone-400 hover:text-destructive"
          >
            <X size={18} aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}